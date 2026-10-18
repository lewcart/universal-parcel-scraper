import { DateTime, FixedOffsetZone } from 'luxon';
import { normalizeTrackingNumber } from '../../core/detection/index.js';
import { IndeterminateError, InvalidInputError, NoHistoryError, NotFoundError, SchemaError } from '../../core/errors/index.js';
import type { CarrierEvent, CarrierResult } from '../../core/result/index.js';
import { languageStageStatus, type Stage } from '../../core/status/index.js';
import { clean, cleanScalar } from '../../core/transport/index.js';
import { isRecord } from '../../core/types.js';
import { eweStage } from './status.js';

export const PROVIDER = 'EWE';
// A long history is a few kilobytes.
export const EWE_MAX_BYTES = 256 * 1024;
// Letters and digits with at least one digit. The trace tracker reads a lower-case number as unknown.
const NUMBER = /^(?=[A-Z]*\d)[A-Z0-9]{8,30}$/;
const MAX_ROWS = 500;
const MAX_EVENTS = 100;

/** A number for EWE's trackers, in upper case; anything else is not one it issues. */
export function normalizeEweNumber(raw: string): string {
  const number = raw.length <= 64 ? normalizeTrackingNumber(raw).toUpperCase() : '';
  if (!NUMBER.test(number)) throw new InvalidInputError(PROVIDER, 'EWE numbers are eight or more letters and digits');
  return number;
}

/** An optional text field; anything but a string is a changed reply. */
function text(row: Record<string, unknown>, key: string, maxLength = 500): string {
  const value = row[key];
  if (value === null || value === undefined) return '';
  if (typeof value !== 'string') throw new SchemaError(PROVIDER, `EWE returned an invalid ${key}`);
  return clean(value, maxLength);
}

// The driver's name after "driver", as in "Our driver Sample will deliver your parcel to you".
const DRIVER = /\b(drivers?)\s+(?!will\b|is\b|has\b)[^.,;!?]*?(?=\s+(?:will|is|has)\b|[.,;!?]|$)/gi;
// A run of nine or more digits, with spaces, brackets, dots or hyphens
// between them, as phone numbers are written; a date stays.
const PHONE = /(?<![A-Z\d])(?!\d{4}-\d{2}-\d{2}(?!\d))\+?\d(?:[\s().-]{0,2}\d){8,}(?![A-Z\d])/gi;

/** A scan's wording without the driver's name or a phone number. */
export function eweWording(raw: string): string {
  return clean(raw.replace(DRIVER, '$1').replace(PHONE, '')).replace(/\s+([,;:.])/g, '$1');
}

/** Newest first; scans on one clock keep their order. */
function newestFirst(events: readonly CarrierEvent[], clock: (event: CarrierEvent) => number): CarrierEvent[] {
  return events.map((event, index) => ({ event, index, key: clock(event) }))
    .sort((a, b) => (a.key === b.key ? a.index - b.index : b.key - a.key))
    .map(({ event }) => event);
}

function summary(events: readonly CarrierEvent[]): CarrierResult {
  if (!events.length) throw new NoHistoryError(PROVIDER);
  const newest = events[0]!;
  const current = events.find((event) => event.stage);
  const stage = current?.stage as Stage | undefined;
  return {
    status: stage ? languageStageStatus(stage) : 'unknown',
    ...(stage ? { current_stage: stage, current_stage_source: current!.stage_source! } : {}),
    last_status_text: newest.description!,
    last_update: typeof newest.time === 'string' ? newest.time : null,
    ...(typeof newest.local_time === 'string' ? { last_update_local: newest.local_time } : {}),
    expected_delivery: null,
    events: events.slice(0, MAX_EVENTS),
    ...(events.length > MAX_EVENTS ? { history_truncated: true } : {}),
  };
}

function rowsOf(value: unknown): unknown[] {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value)) throw new SchemaError(PROVIDER, 'EWE returned invalid scans');
  if (value.length > MAX_ROWS) throw new SchemaError(PROVIDER, 'EWE returned an oversized history');
  return value;
}

// The main lookup's clock: the scanning site's wall clock, to the minute.
const DATE_STRING = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})(?::(\d{2}))?$/;
// Its answer for a number it does not know.
const UNKNOWN = /\bcouldn['’]?t find\b|\bcould not find\b|\bnot in our system\b/i;

/**
 * A scan's clock in the main lookup. `DateString` names no zone, and EWE's
 * sites are in more than one Australian time zone, so the clock stays local.
 */
function wallClock(value: string): string {
  const match = DATE_STRING.exec(value);
  const local = match ? `${match[1]}T${match[2]}:${match[3] ?? '00'}` : '';
  // Parsing in UTC checks the calendar digits only; the wall clock keeps no offset.
  const parsed = DateTime.fromISO(local, { zone: 'UTC' });
  if (!match || !parsed.isValid || parsed.toFormat("yyyy-MM-dd'T'HH:mm:ss") !== local) {
    throw new SchemaError(PROVIDER, 'EWE returned an invalid scan time');
  }
  return local;
}

function lookupEvent(row: unknown): { key: string; event: CarrierEvent } {
  if (!isRecord(row)) throw new SchemaError(PROVIDER, 'EWE returned an invalid scan');
  const description = eweWording(text(row, 'Message'));
  if (!description) throw new SchemaError(PROVIDER, 'EWE returned a scan without wording');
  const local = wallClock(text(row, 'DateString', 32));
  const location = text(row, 'Place', 120);
  const staged = eweStage('', description);
  const event: CarrierEvent = {
    local_time: local,
    ...(location ? { location } : {}),
    description,
    ...(staged ? { stage: staged.stage, stage_source: staged.source } : {}),
  };
  return { key: JSON.stringify([local, description, location]), event };
}

/** The consignment the reply holds for the number: its own, else the one that lists it among its articles. */
function consignmentFor(rows: unknown[], number: string): Record<string, unknown> {
  const entries = rows.map((row) => {
    if (!isRecord(row)) throw new SchemaError(PROVIDER, 'EWE returned an invalid consignment');
    if (typeof row.ConsignmentNo !== 'string') throw new SchemaError(PROVIDER, 'EWE returned a consignment without its number');
    return row;
  });
  const own = entries.find((row) => clean(row.ConsignmentNo, 64).toUpperCase() === number);
  const listing = entries.filter((row) => text(row, 'ArticleNos', 20_000).toUpperCase().split(/[\s,]+/).includes(number));
  const entry = own ?? (listing.length === 1 ? listing[0] : undefined);
  if (!entry) throw new IndeterminateError(PROVIDER, 'EWE answered for another shipment');
  return entry;
}

/**
 * The reply of the lookup EWE's tracking page makes, which answers eMetro
 * consignments and the parcels of EWE's delivery system alike. It answers a
 * number it does not know with HTTP 200, no scans and a `Status` saying so.
 */
export function parseEweLookup(payload: unknown, raw: string): CarrierResult {
  const number = normalizeEweNumber(raw);
  if (!isRecord(payload) || !Array.isArray(payload.Payload)) throw new SchemaError(PROVIDER, 'EWE returned an invalid envelope');
  if (text(payload, 'Error') || !payload.Payload.length) throw new IndeterminateError(PROVIDER, 'EWE did not complete the lookup');
  const entry = consignmentFor(payload.Payload, number);
  const rows = rowsOf(entry.Details);
  if (!rows.length) {
    if (UNKNOWN.test(text(entry, 'Status'))) throw new NotFoundError(PROVIDER);
    throw new NoHistoryError(PROVIDER);
  }
  const seen = new Set<string>();
  const events: CarrierEvent[] = [];
  for (const row of rows) {
    const scan = lookupEvent(row);
    if (seen.has(scan.key)) continue;
    seen.add(scan.key);
    events.push(scan.event);
  }
  // The reply lists eMetro's scans newest first and the delivery system's oldest first.
  return summary(newestFirst(events, (event) => DateTime.fromISO(event.local_time as string, { zone: 'UTC' }).toMillis()));
}

const WALL_TIME = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
const ZONE = /^(?:UTC|GMT)\s*([+-])(\d{1,2})(?::?(\d{2}))?$/i;

function zoneMinutes(value: string): number | null {
  const match = ZONE.exec(value);
  if (!match) return null;
  const minutes = (Number(match[2]) * 60 + Number(match[3] ?? 0)) * (match[1] === '-' ? -1 : 1);
  return minutes % 15 === 0 && minutes >= -12 * 60 && minutes <= 14 * 60 ? minutes : null;
}

/**
 * A scan's instant in the trace reply. `utcOperatorTime` is the scan in UTC,
 * `timeZone` the site's offset and `operatorTime` its wall clock, which must
 * agree with the other two. Without an offset the instant stays in UTC.
 */
function traceTime(row: Record<string, unknown>): string {
  const utc = text(row, 'utcOperatorTime', 32);
  const parsed = DateTime.fromISO(utc.replace(' ', 'T'), { zone: 'UTC' });
  if (!WALL_TIME.test(utc) || !parsed.isValid || parsed.toFormat('yyyy-MM-dd HH:mm:ss') !== utc) {
    throw new SchemaError(PROVIDER, 'EWE returned an invalid scan time');
  }
  const zone = text(row, 'timeZone', 16);
  const minutes = zone ? zoneMinutes(zone) : 0;
  if (minutes === null) throw new SchemaError(PROVIDER, 'EWE returned an invalid scan time zone');
  const local = parsed.setZone(FixedOffsetZone.instance(minutes));
  const wall = text(row, 'operatorTime', 32);
  if (wall && wall !== local.toFormat('yyyy-MM-dd HH:mm:ss')) throw new SchemaError(PROVIDER, 'EWE returned clocks that disagree');
  return local.toISO({ suppressMilliseconds: true })!;
}

function traceEvent(row: unknown, number: string): { key: string; event: CarrierEvent } {
  if (!isRecord(row)) throw new SchemaError(PROVIDER, 'EWE returned an invalid scan');
  if (typeof row.orderNo !== 'string') throw new SchemaError(PROVIDER, 'EWE returned a scan without its number');
  if (clean(row.orderNo, 64).toUpperCase() !== number) throw new IndeterminateError(PROVIDER, 'EWE answered for another shipment');
  const code = cleanScalar(row.action, 40);
  const description = eweWording(text(row, 'routingDescription'));
  if (!description) throw new SchemaError(PROVIDER, 'EWE returned a scan without wording');
  const time = traceTime(row);
  // The suburb and state; the postcode, the coordinates and the photos stay out.
  const city = text(row, 'eventCity', 80);
  const state = text(row, 'eventState', 16);
  const location = city ? [city, state].filter(Boolean).join(', ') : text(row, 'occurLocation', 120);
  const staged = eweStage(code, description);
  const event: CarrierEvent = {
    time,
    ...(location ? { location } : {}),
    description,
    ...(code ? { provider_code: code } : {}),
    ...(staged ? { stage: staged.stage, stage_source: staged.source } : {}),
  };
  return { key: JSON.stringify([time, code, description, location]), event };
}

/**
 * The reply of EWE's trace tracker, which knows the parcels of EWE's delivery
 * system only. It answers a number it does not know with code 404, "Order
 * does not exist", inside an HTTP 200 reply.
 */
export function parseEweTrace(payload: unknown, raw: string): CarrierResult {
  const number = normalizeEweNumber(raw);
  if (!isRecord(payload) || typeof payload.code !== 'number') throw new SchemaError(PROVIDER, 'EWE returned an invalid envelope');
  if (payload.code === 404) throw new NotFoundError(PROVIDER);
  if (payload.code !== 200) throw new IndeterminateError(PROVIDER, 'EWE did not complete the lookup');
  if (!isRecord(payload.data)) throw new SchemaError(PROVIDER, 'EWE returned an invalid envelope');
  const seen = new Set<string>();
  const events: CarrierEvent[] = [];
  for (const row of rowsOf(payload.data.orderRoutes)) {
    const scan = traceEvent(row, number);
    if (seen.has(scan.key)) continue;
    seen.add(scan.key);
    events.push(scan.event);
  }
  return summary(newestFirst(events, (event) => DateTime.fromISO(event.time as string, { setZone: true }).toMillis()));
}
