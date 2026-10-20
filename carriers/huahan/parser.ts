import { DateTime } from 'luxon';
import { carrierIdFromPartner } from '../../core/catalog/hints.js';
import { detectCarrierMatch, normalizeTrackingNumber } from '../../core/detection/index.js';
import { USPS_ROUTING_BARCODE, uspsPackageIdentifier } from '../../core/detection/usps.js';
import { ChallengeError, IndeterminateError, InvalidInputError, NoHistoryError, NotFoundError, RateLimitedError, SchemaError } from '../../core/errors/index.js';
import type { CarrierEvent, CarrierResult } from '../../core/result/index.js';
import { languageStageStatus } from '../../core/status/index.js';
import { countryCode, countryTimeZone, isoTime } from '../../core/time/index.js';
import { clean } from '../../core/transport/text.js';
import { isRecord } from '../../core/types.js';
import { huahanStage } from './status.js';

export const PROVIDER = 'HuaHan Logistics';

export function normalizeHuahanNumber(raw: string): string {
  const number = raw.length <= 64 ? normalizeTrackingNumber(raw) : '';
  if (!/^HHW[A-Z]{2}\d{10}YQ$/.test(number)) throw new InvalidInputError(PROVIDER, 'HuaHan requires its complete waybill number');
  return number;
}

function text(row: Record<string, unknown>, key: string, max = 500): string {
  const value = row[key];
  if (value == null) return '';
  if (typeof value !== 'string' || value.length > max) throw new SchemaError(PROVIDER, 'HuaHan returned an invalid tracking field');
  return clean(value, max);
}

/** A partner field: anything but a string is left out rather than failing the lookup. */
function partnerText(row: Record<string, unknown>, key: string): string {
  return typeof row[key] === 'string' ? clean(row[key], 80) : '';
}

/**
 * The destination carrier and its number from `Local_Carrier` and
 * `Local_Number`. The number can end in a suffix after an underscore
 * ("…_D104") that the partner's own number lacks. The carrier is named only
 * when the catalog knows it and its rules fit the number; a USPS routing
 * barcode gives its package identifier.
 */
function handoff(row: Record<string, unknown>, number: string): Pick<CarrierResult, 'delivery_carrier' | 'delivery_tracking_number'> {
  const compact = normalizeTrackingNumber(partnerText(row, 'Local_Number').split('_')[0]!).toUpperCase();
  const reference = USPS_ROUTING_BARCODE.test(compact) ? uspsPackageIdentifier(compact) ?? '' : compact;
  if (!/^[A-Z0-9]{4,40}$/.test(reference) || reference === number) return {};
  const partner = carrierIdFromPartner(partnerText(row, 'Local_Carrier'));
  const named = partner && partner !== 'huahan' && (detectCarrierMatch(reference).candidates as string[]).includes(partner);
  return { ...(named ? { delivery_carrier: partner } : {}), delivery_tracking_number: reference };
}

function clock(value: string): string {
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
    const parsed = DateTime.fromFormat(value, 'yyyy-MM-dd HH:mm:ss', { zone: 'UTC' });
    if (parsed.isValid && parsed.toFormat('yyyy-MM-dd HH:mm:ss') === value) return value.replace(' ', 'T');
  }
  throw new SchemaError(PROVIDER, 'HuaHan returned an invalid scan clock');
}

/** The public form submits one whole waybill; aliases and partner numbers do not bind its reply. */
export function parseHuahan(payload: unknown, raw: string): CarrierResult {
  const number = normalizeHuahanNumber(raw);
  if (!isRecord(payload)) throw new SchemaError(PROVIDER, 'HuaHan returned an invalid envelope');
  if (payload.ask === 0) {
    const message = text(payload, 'msg');
    if (/验证|驗證|captcha|verification/i.test(message)) throw new ChallengeError(PROVIDER, 'HuaHan refused verification');
    if (/频繁|頻繁|too many|rate limit/i.test(message)) throw new RateLimitedError(PROVIDER);
    if (message === '没有找到记录' && Array.isArray(payload.data) && payload.data.length === 0) throw new NotFoundError(PROVIDER);
    throw new IndeterminateError(PROVIDER, 'HuaHan could not answer this lookup');
  }
  if (payload.ask !== 1 || !Array.isArray(payload.data) || payload.data.length !== 1 || !isRecord(payload.data[0])) {
    throw new SchemaError(PROVIDER, 'HuaHan returned no unique tracking result');
  }
  const row = payload.data[0];
  if (text(row, 'Code', 64).toUpperCase() !== number) throw new SchemaError(PROVIDER, 'HuaHan returned another waybill');
  if (text(row, 'Error_code', 32) !== '0000') throw new IndeterminateError(PROVIDER, 'HuaHan did not confirm its tracking result');
  if (!Array.isArray(row.Detail) || row.Detail.length > 500) throw new SchemaError(PROVIDER, 'HuaHan returned an invalid history');
  if (!row.Detail.length) throw new NoHistoryError(PROVIDER);
  const events: CarrierEvent[] = row.Detail.map((scan: unknown) => {
    if (!isRecord(scan)) throw new SchemaError(PROVIDER, 'HuaHan returned an invalid scan');
    const description = text(scan, 'Comment');
    if (!description) throw new SchemaError(PROVIDER, 'HuaHan returned an empty scan');
    const code = text(scan, 'Status', 32);
    const location = text(scan, 'track_area', 200);
    const staged = huahanStage(code, description);
    return { local_time: clock(text(scan, 'Occur_date', 32)), description,
      ...(code ? { provider_code: code } : {}), ...(location ? { location } : {}),
      ...(staged ? { stage: staged.stage, stage_source: staged.source } : {}) };
  });
  // The page renders Detail in server order, newest first. Clocks from different facilities cannot be sorted as instants.
  const newest = events[0]!;
  const current = huahanStage(newest.provider_code ?? '', newest.description!) ?? huahanStage('', text(row, 'Status'));
  const country = countryCode(partnerText(row, 'Country_code')) ?? undefined;
  // The scans after the hand-off to the destination carrier (JY) relay that
  // carrier's own clock: a destination of one zone places them. HuaHan's own
  // scans keep their wall clocks.
  const handedOver = events.findIndex((event) => event.provider_code === 'JY');
  const zone = handedOver > 0 && country ? countryTimeZone(country) : null;
  const placed = zone ? events.map(({ local_time, ...event }, index): CarrierEvent => {
    const time = index < handedOver ? isoTime(local_time, zone)?.iso : undefined;
    return time ? { time, ...event } : { local_time, ...event };
  }) : events;
  const latest = placed[0]!;
  return { status: current ? languageStageStatus(current.stage) : 'unknown',
    ...(current ? { current_stage: current.stage, current_stage_source: current.source } : {}),
    ...(newest.provider_code ? { provider_code: newest.provider_code } : {}),
    last_status_text: newest.description!, last_update: latest.time ?? null,
    ...(latest.time ? {} : { last_update_local: newest.local_time! }), expected_delivery: null,
    ...(country ? { destination_country: country } : {}), ...handoff(row, number),
    events: placed.slice(0, 100), ...(placed.length > 100 ? { history_truncated: true } : {}) };
}
