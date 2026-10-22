import { DateTime } from 'luxon';
import { normalizeTrackingNumber } from '../../core/detection/index.js';
import { IndeterminateError, InvalidInputError, NoHistoryError, NotFoundError, SchemaError } from '../../core/errors/index.js';
import type { CarrierEvent, CarrierResult } from '../../core/result/index.js';
import { languageStageStatus, type Stage } from '../../core/status/index.js';
import { countryCode, explicitOffsetTime } from '../../core/time/index.js';
import { clean } from '../../core/transport/index.js';
import { isRecord } from '../../core/types.js';
import { dayoneCodeStage, dayoneStage } from './status.js';

export const PROVIDER = 'DayOne';
// One parcel's reply is a few kilobytes.
export const DAYONE_MAX_BYTES = 512 * 1024;

// DOT and sixteen digits.
const NUMBER = /^DOT\d{16}$/;
const CLOCK = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/;
const OFFSET = /^[+-](?:0\d|1[0-4]):[0-5]\d$/;
const REFERENCE = /^[A-Z0-9]{4,40}$/;
const MAX_ROWS = 500;
const MAX_EVENTS = 100;
// Four to six digits standing alone in a place are a postcode.
const POSTCODE_RUN = /(^|[^\p{L}\p{N}])\d{4,6}(?![\p{L}\p{N}])/gu;
// Who took a delivered parcel, as a delivery line can name them.
const RECEIVER = /\s*[,;:.\-–]?\s*\b(?:(?:signed|received|collected|accepted)(?:\s+for)?\s+by|signatory|signature)\b.*$/i;

/** A DayOne parcel number; anything else is not one it issues. */
export function normalizeDayoneNumber(raw: string): string {
  const number = typeof raw === 'string' && raw.length <= 64 ? normalizeTrackingNumber(raw) : '';
  if (!NUMBER.test(number)) throw new InvalidInputError(PROVIDER, 'DayOne parcel numbers are DOT and sixteen digits');
  return number;
}

/** An optional text field; anything but a string is a changed reply. */
function text(row: Record<string, unknown>, key: string, maxLength = 300): string {
  const value = row[key];
  if (value === null || value === undefined) return '';
  if (typeof value !== 'string') throw new SchemaError(PROVIDER, `DayOne returned an invalid ${key}`);
  return clean(value, maxLength);
}

/** A scan's wall clock to the second, and its instant when the scan states a valid offset. */
function scanClock(row: Record<string, unknown>): { local: string; instant?: { iso: string; timestamp: number } } {
  const match = CLOCK.exec(text(row, 'track_occur_date', 40));
  const local = match ? `${match[1]}T${match[2]}` : '';
  // Parsing in UTC checks the calendar digits only; Luxon rolls 24:00:00 over, so only a clock that reads back unchanged is kept.
  const parsed = DateTime.fromISO(local, { zone: 'UTC' });
  if (!match || !parsed.isValid || parsed.toFormat("yyyy-MM-dd'T'HH:mm:ss") !== local) {
    throw new SchemaError(PROVIDER, 'DayOne returned an invalid scan time');
  }
  const offset = text(row, 'gmt_offset', 16);
  const instant = OFFSET.test(offset) ? explicitOffsetTime(`${local}${offset}`) : null;
  return instant ? { local, instant } : { local };
}

/**
 * The reply of the tracker's `Service.ashx` lookup for one number: `data`
 * holds an entry per number, with its summary status as a code and the
 * network's scans, newest wall clock first, each with the offset of its
 * place. A number the tracker does not know gets `success` 0 and its "No
 * query to track information" message. Only the entry whose
 * `server_hawbcode` is the whole number asked is read; the merchant's order
 * reference, the signatory and the proof of delivery are never read.
 */
export function parseDayone(payload: unknown, raw: string): CarrierResult {
  const number = normalizeDayoneNumber(raw);
  if (!isRecord(payload)) throw new SchemaError(PROVIDER, 'DayOne returned an invalid reply');
  if (payload.success === 0) {
    const message = `${text(payload, 'enmessage', 200)} ${text(payload, 'cnmessage', 200)}`;
    if (/No query to track information|未查询到轨迹信息/i.test(message)) throw new NotFoundError(PROVIDER, 'DayOne has no parcel under this number');
    // The answer to a lookup whose key does not match its request.
    if (/Parameter error|参数错误/i.test(message)) throw new SchemaError(PROVIDER, 'DayOne refused the lookup request');
    throw new IndeterminateError(PROVIDER, 'DayOne did not complete the lookup');
  }
  if (payload.success !== 1 || !Array.isArray(payload.data)) throw new SchemaError(PROVIDER, 'DayOne returned an invalid reply');
  const bound = payload.data.filter((item: unknown) => isRecord(item) && typeof item.server_hawbcode === 'string'
    && normalizeTrackingNumber(item.server_hawbcode) === number) as Record<string, unknown>[];
  if (bound.length !== 1) throw new SchemaError(PROVIDER, 'DayOne did not answer for the parcel asked');
  const item = bound[0]!;
  const rows = item.details;
  if (!Array.isArray(rows)) throw new SchemaError(PROVIDER, 'DayOne returned a parcel with invalid scans');
  if (rows.length > MAX_ROWS) throw new SchemaError(PROVIDER, 'DayOne returned an oversized history');

  const seen = new Set<string>();
  const scans: { event: CarrierEvent; at: number | null; index: number }[] = [];
  for (const row of rows) {
    if (!isRecord(row)) throw new SchemaError(PROVIDER, 'DayOne returned an invalid scan');
    const { local, instant } = scanClock(row);
    const wording = text(row, 'track_description_en') || text(row, 'track_description');
    const description = clean(/^delivered\b/i.test(wording) ? wording.replace(RECEIVER, '') : wording, 300);
    // A row without wording says nothing.
    if (!description) continue;
    const location = clean(text(row, 'track_location', 120).replace(POSTCODE_RUN, '$1'), 120).replace(/^[\s,;:]+|[\s,;:]+$/g, '');
    const key = JSON.stringify([instant?.iso ?? local, location, description]);
    if (seen.has(key)) continue;
    seen.add(key);
    const staged = dayoneStage(description);
    scans.push({ at: instant?.timestamp ?? null, index: scans.length, event: {
      // A scan without its place's offset keeps its wall clock.
      ...(instant ? { time: instant.iso } : { local_time: local }),
      ...(location ? { location } : {}),
      description,
      ...(staged ? { stage: staged.stage, stage_source: staged.source } : {}),
    } });
  }
  if (!scans.length) throw new NoHistoryError(PROVIDER);
  // The tracker orders the scans by their wall clocks, whatever their offsets. When every
  // scan has an instant they are ordered by it, equal ones in the tracker's order.
  if (scans.every((scan) => scan.at !== null)) scans.sort((left, right) => right.at! - left.at! || left.index - right.index);

  const events = scans.map((scan) => scan.event);
  const newest = events[0]!;
  // The destination post's manifest, relayed after the parcel moved, is no step back. The
  // summary's status decides only when no scan has a stage.
  const scanned = events.find((event) => event.stage && event.stage !== 'registered') ?? events.find((event) => event.stage);
  const code = text(item, 'track_status', 8).toUpperCase();
  const stage = (scanned?.stage ?? dayoneCodeStage(code)) as Stage | undefined;
  const destination = text(item, 'destination_country', 8);
  const destinationName = text(item, 'destination_country_enname', 80);
  const country = countryCode(destination) ?? countryCode(destinationName);
  const channel = normalizeTrackingNumber(text(item, 'channel_hawbcode', 64));
  return {
    status: stage ? languageStageStatus(stage) : 'unknown',
    ...(stage ? { current_stage: stage, current_stage_source: scanned?.stage_source ?? 'carrier_map' } : {}),
    last_status_text: newest.description!,
    last_update: newest.time ?? null,
    ...(newest.local_time ? { last_update_local: newest.local_time } : {}),
    expected_delivery: null,
    ...(stage === 'delivered' && scanned?.time ? { delivered_at: scanned.time } : {}),
    ...(country ? { destination_country: country } : destinationName ? { destination_country_name: destinationName } : {}),
    // The network's own number for the parcel; the hand-off decides who that is.
    ...(REFERENCE.test(channel) && channel !== number ? { delivery_tracking_number: channel } : {}),
    events: events.slice(0, MAX_EVENTS),
    ...(events.length > MAX_EVENTS ? { history_truncated: true } : {}),
  };
}
