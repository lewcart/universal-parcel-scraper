import { DateTime } from 'luxon';
import { normalizeTrackingNumber } from '../../core/detection/index.js';
import { IndeterminateError, InvalidInputError, NoHistoryError, NotFoundError, SchemaError } from '../../core/errors/index.js';
import type { CarrierEvent, CarrierResult } from '../../core/result/index.js';
import { languageStageStatus, type Stage } from '../../core/status/index.js';
import { countryCode, zonedTime } from '../../core/time/index.js';
import { clean, textFromHtml } from '../../core/transport/index.js';
import { isRecord } from '../../core/types.js';
import { CTTYEX_NOT_FOUND, cttyexChinaStep, cttyexMappedStage, cttyexStage } from './status.js';

export const PROVIDER = 'CTTYEX';
// One parcel's reply is about a kilobyte.
export const CTTYEX_MAX_BYTES = 256 * 1024;
/** CTTYEX's own steps are in China; the tracker prints their wall clocks without a zone. */
export const CTTYEX_ZONE = 'Asia/Shanghai';
// Letters and digits with at least one digit. The tracker matches the whole number, in capitals.
const NUMBER = /^(?=[A-Z]*\d)[A-Z0-9]{8,40}$/;
const CLOCK = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
const MAX_ROWS = 200;

/** A number for CTTYEX's tracker, in capitals; anything else is not one it issues. */
export function normalizeCttyexNumber(raw: string): string {
  const number = typeof raw === 'string' && raw.length <= 64 ? normalizeTrackingNumber(raw).toUpperCase() : '';
  if (!NUMBER.test(number)) throw new InvalidInputError(PROVIDER, 'CTTYEX numbers are eight or more letters and digits');
  return number;
}

/** An optional text field; anything but a string is a changed reply. */
function text(row: Record<string, unknown>, key: string, maxLength = 300): string {
  const value = row[key];
  if (value === null || value === undefined) return '';
  if (typeof value !== 'string') throw new SchemaError(PROVIDER, `CTTYEX returned an invalid ${key}`);
  return clean(value, maxLength);
}

const CHINESE_REGIONS = new Intl.DisplayNames(['zh-Hans'], { type: 'region' });
const NOT_COUNTRIES = new Set(['EU', 'EZ', 'QO', 'UN', 'ZZ']);
// Current ISO regions by their Simplified Chinese name, plus the short forms
// of the special administrative regions.
const COUNTRY_BY_NAME: ReadonlyMap<string, string> = new Map([
  ...Array.from({ length: 26 * 26 }, (_, index) => String.fromCharCode(65 + Math.floor(index / 26), 65 + (index % 26)))
    .filter((code) => countryCode(code) === code && !NOT_COUNTRIES.has(code) && !code.startsWith('X'))
    .map((code) => [CHINESE_REGIONS.of(code) ?? code, code] as const)
    .filter(([name, code]) => name !== code),
  ['香港', 'HK'], ['中国香港', 'HK'], ['澳门', 'MO'], ['中国澳门', 'MO'], ['中国台湾', 'TW'],
]);

/**
 * A scan's clock. CTTYEX's own steps are in China, so their wall clock is an
 * instant on Beijing time. A wording the map does not list could come from
 * another leg and keeps its wall clock.
 */
function scanClock(value: string, chinaStep: boolean): { time: string } | { local_time: string } {
  const wall = value.replace(' ', 'T');
  if (!CLOCK.test(value)) throw new SchemaError(PROVIDER, 'CTTYEX returned an invalid scan time');
  if (chinaStep) {
    const parsed = zonedTime(value, 'yyyy-MM-dd HH:mm:ss', CTTYEX_ZONE);
    // Only a clock that reads back unchanged is kept: Luxon would roll 24:00 over to the next day.
    if (!parsed || parsed.iso.slice(0, 19) !== wall) throw new SchemaError(PROVIDER, 'CTTYEX returned an invalid scan time');
    return { time: parsed.iso };
  }
  // Parsing in UTC checks the calendar digits only; the wall clock keeps no offset.
  const parsed = DateTime.fromISO(wall, { zone: 'UTC' });
  if (!parsed.isValid || parsed.toFormat("yyyy-MM-dd'T'HH:mm:ss") !== wall) throw new SchemaError(PROVIDER, 'CTTYEX returned an invalid scan time');
  return { local_time: wall };
}

function projectRow(row: Record<string, unknown>): { key: string; wall: string; event: CarrierEvent } {
  if (typeof row.content !== 'string') throw new SchemaError(PROVIDER, 'CTTYEX returned a scan without wording');
  // The page writes a row's content as HTML.
  const description = textFromHtml(row.content, 300);
  if (!description) throw new SchemaError(PROVIDER, 'CTTYEX returned a scan without wording');
  const clock = text(row, 'create_time', 32);
  const staged = cttyexStage(description);
  const event: CarrierEvent = {
    ...scanClock(clock, cttyexChinaStep(description)),
    description,
    ...(staged ? { stage: staged.stage, stage_source: staged.source } : {}),
  };
  return { key: JSON.stringify([clock, description]), wall: clock, event };
}

/**
 * The reply of the tracking page's `getTrackingByNos` for one number: a JSON
 * array with an item per number asked, holding the summary's status, the
 * origin and destination countries in Chinese and the scans. A number the
 * tracker does not know gets "查询不到" ("Not Found" in English) and no scans.
 * The item must name the number asked.
 */
export function parseCttyex(payload: unknown, raw: string): CarrierResult {
  const number = normalizeCttyexNumber(raw);
  // The answer to a lookup without a number; it never comes for one.
  if (isRecord(payload) && payload.success === false) throw new IndeterminateError(PROVIDER, 'CTTYEX did not complete the lookup');
  if (!Array.isArray(payload)) throw new SchemaError(PROVIDER, 'CTTYEX returned an invalid reply');
  if (payload.length !== 1) throw new SchemaError(PROVIDER, 'CTTYEX answered for another number of parcels than asked');
  const item: unknown = payload[0];
  if (!isRecord(item) || typeof item.no !== 'string') throw new SchemaError(PROVIDER, 'CTTYEX returned a parcel without its number');
  if (clean(item.no, 64) !== number) throw new IndeterminateError(PROVIDER, 'CTTYEX answered for another shipment');
  const status = text(item, 'status', 40);
  const rows = item.details;
  if (!Array.isArray(rows)) throw new SchemaError(PROVIDER, 'CTTYEX returned a parcel with invalid scans');
  if (CTTYEX_NOT_FOUND.includes(status)) {
    if (rows.length) throw new SchemaError(PROVIDER, 'CTTYEX returned scans for a number it does not know');
    throw new NotFoundError(PROVIDER, 'CTTYEX has no parcel under this number');
  }
  if (rows.length > MAX_ROWS) throw new SchemaError(PROVIDER, 'CTTYEX returned an oversized history');

  const seen = new Set<string>();
  const scans: { wall: string; event: CarrierEvent }[] = [];
  for (const row of rows) {
    if (!isRecord(row)) throw new SchemaError(PROVIDER, 'CTTYEX returned an invalid scan');
    const scan = projectRow(row);
    if (seen.has(scan.key)) continue;
    seen.add(scan.key);
    scans.push(scan);
  }
  if (!scans.length) throw new NoHistoryError(PROVIDER);
  // Newest first, as the tracker lists them; an oldest-first reply is turned round.
  if (scans[0]!.wall < scans.at(-1)!.wall) scans.reverse();
  const events = scans.map((scan) => scan.event);

  const newest = events[0]!;
  // The newest staged scan decides; the summary's status only when no scan has a stage.
  const scanned = events.find((event) => event.stage);
  const summary = cttyexMappedStage(status);
  const stage = (scanned?.stage ?? summary) as Stage | undefined;
  const source = scanned?.stage_source ?? 'carrier_map';
  const destination = text(item, 'toCountry', 40);
  const country = COUNTRY_BY_NAME.get(destination) ?? countryCode(destination);
  return {
    status: stage ? languageStageStatus(stage) : 'unknown',
    ...(stage ? { current_stage: stage, current_stage_source: source } : {}),
    last_status_text: newest.description!,
    last_update: typeof newest.time === 'string' ? newest.time : null,
    last_update_local: typeof newest.local_time === 'string' ? newest.local_time : null,
    expected_delivery: null,
    ...(country ? { destination_country: country } : destination ? { destination_country_name: destination } : {}),
    events,
  };
}
