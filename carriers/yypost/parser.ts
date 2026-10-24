import { DateTime } from 'luxon';
import { detectCarrierMatch, normalizeTrackingNumber } from '../../core/detection/index.js';
import { IndeterminateError, InvalidInputError, NoHistoryError, NotFoundError, SchemaError } from '../../core/errors/index.js';
import type { CarrierEvent, CarrierResult } from '../../core/result/index.js';
import { languageStageStatus, type Stage } from '../../core/status/index.js';
import { countryCode, isoTime } from '../../core/time/index.js';
import { clean, cleanScalar } from '../../core/transport/index.js';
import { isRecord } from '../../core/types.js';
import { yypostStage } from './status.js';

export const PROVIDER = 'YYpost';
// One parcel's reply is a few kilobytes.
export const YYPOST_MAX_BYTES = 512 * 1024;

// YY, nine digits and CN.
const NUMBER = /^YY\d{9}CN$/;
const CLOCK = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/;
const REFERENCE = /^[A-Z0-9]{4,40}$/;
const MAX_ROWS = 500;
const MAX_EVENTS = 100;
// Four to six digits standing alone in a place are a postcode.
const POSTCODE_RUN = /(^|[^\p{L}\p{N}])\d{4,6}(?![\p{L}\p{N}])/gu;
// Who took a delivered parcel, as a delivery line can name them.
const RECEIVER = /\s*[,;:.\-–]?\s*\b(?:(?:signed|received|collected|accepted)(?:\s+for)?\s+by|signatory|signature)\b.*$/i;
// The clocks of onward networks whose rows YYpost relays on them, by the
// carrier the onward number belongs to. Ecoscooting's order creation falls to
// the second of Ecoscooting's own record of it on Spain's clock.
const ONWARD_CLOCKS: Readonly<Record<string, string>> = { ecoscooting: 'Europe/Madrid' };

/** A YYpost parcel number; anything else is not one its tracker answers. */
export function normalizeYypostNumber(raw: string): string {
  const number = typeof raw === 'string' && raw.length <= 64 ? normalizeTrackingNumber(raw) : '';
  if (!NUMBER.test(number)) throw new InvalidInputError(PROVIDER, 'YYpost parcel numbers are YY, nine digits and CN');
  return number;
}

/** An optional text field; anything but a string is a changed reply. */
function text(row: Record<string, unknown>, key: string, maxLength = 300): string {
  const value = row[key];
  if (value === null || value === undefined) return '';
  if (typeof value !== 'string') throw new SchemaError(PROVIDER, `YYpost returned an invalid ${key}`);
  return clean(value, maxLength);
}

/** A scan's wall clock to the second. */
function scanClock(row: Record<string, unknown>): string {
  const match = CLOCK.exec(text(row, 'track_occur_date', 40));
  const local = match ? `${match[1]}T${match[2]}` : '';
  // Parsing in UTC checks the calendar digits only; Luxon rolls 24:00:00 over, so only a clock that reads back unchanged is kept.
  const parsed = DateTime.fromISO(local, { zone: 'UTC' });
  if (!match || !parsed.isValid || parsed.toFormat("yyyy-MM-dd'T'HH:mm:ss") !== local) {
    throw new SchemaError(PROVIDER, 'YYpost returned an invalid scan time');
  }
  return local;
}

/**
 * The reply of the tracker's `Service.ashx` lookup for one number: `data`
 * holds an entry per number, with the scans newest first, each a wall clock
 * without a zone, a place and English and Chinese wording. A number the
 * tracker does not know gets `success` 0 and its "No query to track
 * information" message. Only the entry whose `server_hawbcode` is the whole
 * number asked is read; the merchant's order reference, the signatory and the
 * proof of delivery are never read.
 */
export function parseYypost(payload: unknown, raw: string): CarrierResult {
  const number = normalizeYypostNumber(raw);
  if (!isRecord(payload)) throw new SchemaError(PROVIDER, 'YYpost returned an invalid reply');
  if (payload.success === 0) {
    const message = `${text(payload, 'enmessage', 200)} ${text(payload, 'cnmessage', 200)}`;
    if (/No query to track information|未查询到轨迹信息/i.test(message)) throw new NotFoundError(PROVIDER, 'YYpost has no parcel under this number');
    // The answer to a lookup whose key does not match its request.
    if (/Parameter error|参数错误/i.test(message)) throw new SchemaError(PROVIDER, 'YYpost refused the lookup request');
    throw new IndeterminateError(PROVIDER, 'YYpost did not complete the lookup');
  }
  if (payload.success !== 1 || !Array.isArray(payload.data)) throw new SchemaError(PROVIDER, 'YYpost returned an invalid reply');
  const bound = payload.data.filter((item: unknown) => isRecord(item) && typeof item.server_hawbcode === 'string'
    && normalizeTrackingNumber(item.server_hawbcode) === number) as Record<string, unknown>[];
  if (bound.length !== 1) throw new SchemaError(PROVIDER, 'YYpost did not answer for the parcel asked');
  const item = bound[0]!;
  const rows = item.details;
  if (!Array.isArray(rows)) throw new SchemaError(PROVIDER, 'YYpost returned a parcel with invalid scans');
  if (rows.length > MAX_ROWS) throw new SchemaError(PROVIDER, 'YYpost returned an oversized history');

  const channel = normalizeTrackingNumber(text(item, 'channel_hawbcode', 64));
  const onward = REFERENCE.test(channel) && channel !== number ? channel : '';
  const detected = onward ? detectCarrierMatch(onward) : null;
  const onwardClock = detected?.confidence === 'high' && Object.hasOwn(ONWARD_CLOCKS, detected.carrier)
    ? ONWARD_CLOCKS[detected.carrier] : undefined;

  const seen = new Set<string>();
  const events: CarrierEvent[] = [];
  for (const row of rows) {
    if (!isRecord(row)) throw new SchemaError(PROVIDER, 'YYpost returned an invalid scan');
    const local = scanClock(row);
    const wording = text(row, 'track_description_en') || text(row, 'track_description');
    const description = clean(/^delivered\b/i.test(wording) ? wording.replace(RECEIVER, '') : wording, 300);
    // A row without wording says nothing.
    if (!description) continue;
    const location = clean(text(row, 'track_location', 120).replace(POSTCODE_RUN, '$1'), 120).replace(/^[\s,;:]+|[\s,;:]+$/g, '');
    const key = JSON.stringify([local, location, description]);
    if (seen.has(key)) continue;
    seen.add(key);
    const staged = yypostStage(description);
    // A row without a code of YYpost's or a place is the onward network's, on that network's clock.
    const relayed = onwardClock && !cleanScalar(row.track_code, 40) && !location ? isoTime(local, onwardClock) : null;
    events.push({
      ...(relayed ? { time: relayed.iso } : { local_time: local }),
      ...(location ? { location } : {}),
      description,
      ...(staged ? { stage: staged.stage, stage_source: staged.source } : {}),
    });
  }
  if (!events.length) throw new NoHistoryError(PROVIDER);

  const newest = events[0]!;
  // The shipment order the line records once the parcel has left the warehouse is no step back.
  const staged = events.find((event) => event.stage && event.stage !== 'registered') ?? events.find((event) => event.stage);
  const stage = staged?.stage as Stage | undefined;
  const country = countryCode(text(item, 'destination_country', 8));
  return {
    status: stage ? languageStageStatus(stage) : 'unknown',
    ...(stage ? { current_stage: stage, current_stage_source: staged!.stage_source } : {}),
    last_status_text: newest.description!,
    last_update: newest.time ?? null,
    ...(newest.local_time ? { last_update_local: newest.local_time } : {}),
    expected_delivery: null,
    ...(country ? { destination_country: country } : {}),
    // The number of the network that carries the parcel on; the hand-off decides who that is.
    ...(onward ? { delivery_tracking_number: onward } : {}),
    events: events.slice(0, MAX_EVENTS),
    ...(events.length > MAX_EVENTS ? { history_truncated: true } : {}),
  };
}
