import { DateTime, FixedOffsetZone } from 'luxon';
import { normalizeTrackingNumber } from '../../core/detection/index.js';
import { IndeterminateError, InvalidInputError, NotFoundError, SchemaError } from '../../core/errors/index.js';
import type { CarrierEvent, CarrierResult } from '../../core/result/index.js';
import { languageStageStatus, type Stage } from '../../core/status/index.js';
import { firstOccurrence } from '../../core/time/index.js';
import { cleanScalar } from '../../core/transport/index.js';
import { isRecord } from '../../core/types.js';
import { dhlinkStage } from './status.js';

export const PROVIDER = 'DHLink';
// A long history is a few dozen kilobytes.
export const DHLINK_MAX_BYTES = 512 * 1024;
// DHLink numbers, waybills and line providers' numbers: letters and digits, with a digit.
const NUMBER = /^(?=[A-Z]*\d)[A-Z0-9]{8,40}$/;
const WALL_CLOCK = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/;
// The earliest instant a wall clock can stand for: a row still after the read at UTC+14 is written ahead of its time.
const EARLIEST = FixedOffsetZone.instance(14 * 60);
const MAX_ROWS = 500;
const MAX_EVENTS = 100;
// DHLink's own number, FC and thirteen digits.
const DHLINK_NUMBER = /^FC\d{13}$/;
const STATE_NOT_FOUND = 1;
const STATE_DELIVERED = 3;
const CJK = /[㐀-鿿豈-﫿]/;
const COUNTRY = /^[A-Z]{2}$/;
const PLACEHOLDERS = new Set(['', '.', '-', 'none', 'null', 'unknown']);
// A state with its ZIP code, as relayed USPS rows name the office: the state stays.
const STATE_ZIP = /\b([A-Z]{2})[ ,;]+\d{5}(?:-\d{4})?\b/g;
// British and Canadian postcodes.
const POSTCODE = /\b(?:[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}|[A-Z]\d[A-Z] ?\d[A-Z]\d)\b/g;
// Contact or signature details a relayed post can append: the scan's wording is what comes before.
const CONTACT = /(?:投递员|快递员|派送员|联系电话|电话[:：]|手机[:：]|签收人[:：]|代收人[:：]|收件人[:：]|signed (?:for )?by\b|signature[:：]|\btel(?:ephone)?[:.：]|\bphone[:：])[\s\S]*$/i;

/**
 * DHLink's last-leg partners. The reply gives the last leg's number
 * (`lastTurnNo`) but names no partner, so the partner is read from the
 * number's whole layout. A number no layout fits gives no hand-off.
 */
export const DHLINK_LAST_LEGS: readonly { readonly carrier: string; readonly number: RegExp }[] = [
  // SwiftX's own numbers: SWX and eighteen digits, the layout `swiftx-1` claims.
  { carrier: 'swiftx', number: /^SWX\d{18}$/ },
];

/** A number DHLink's tracker can be asked for; anything else is not sent. */
export function normalizeDhlinkNumber(raw: string): string {
  const number = raw.length <= 64 ? normalizeTrackingNumber(raw) : '';
  if (!NUMBER.test(number)) throw new InvalidInputError(PROVIDER, 'DHLink tracking numbers are 8 to 40 letters and digits');
  return number;
}

/** An optional text field; an object or array is a changed reply. */
function text(row: Record<string, unknown>, key: string, maxLength = 500): string {
  const value = row[key];
  if (value === null || value === undefined) return '';
  if (typeof value !== 'string' && typeof value !== 'number') throw new SchemaError(PROVIDER, `DHLink returned an invalid ${key}`);
  return cleanScalar(value, maxLength);
}

function withoutPostcodes(value: string): string {
  return value.replace(STATE_ZIP, '$1').replace(POSTCODE, '').replace(/\s+/g, ' ').trim();
}

function wordingOf(info: string): string {
  return withoutPostcodes(info.replace(CONTACT, '')).replace(/[\s,，;；:：(（]+$/, '');
}

/** The words of a place part before the first one holding a digit: a postcode or a street number. */
function beforeDigits(part: string): string {
  const words = part.split(' ');
  const index = words.findIndex((word) => /\d/.test(word));
  return (index < 0 ? words : words.slice(0, index)).join(' ');
}

/**
 * A row's place without its postcode or placeholder. One feed appends the
 * destination's code to Chinese places ("广州市,GB"), and a code alone names
 * no place.
 */
function placeOf(raw: string): string {
  const parts = withoutPostcodes(raw).split(/[,;]/).map((part) => beforeDigits(part.trim()))
    .filter((part) => !PLACEHOLDERS.has(part.toLowerCase()));
  const kept = parts.some((part) => CJK.test(part)) ? parts.filter((part) => !COUNTRY.test(part)) : parts;
  return kept.every((part) => COUNTRY.test(part)) ? '' : [...new Set(kept)].join(', ');
}

interface Scan {
  stamp: string;
  event: CarrierEvent;
  /** Ranks the rows that share a clock: DHLink's node, English, a place, a stage, then the longer wording. */
  rank: readonly number[];
}

function projectRow(row: unknown, readAt: number): Scan | 'ahead' | null {
  if (!isRecord(row)) throw new SchemaError(PROVIDER, 'DHLink returned an invalid scan');
  const stamp = text(row, 'trackTime', 64);
  const wall = WALL_CLOCK.exec(stamp);
  const local = wall ? `${wall[1]}T${wall[2]}` : '';
  const earliest = local ? firstOccurrence(DateTime.fromISO(local, { zone: EARLIEST })) : null;
  // Luxon rolls 24:00:00 over to the next day; only a clock that reads back unchanged is kept.
  if (!earliest?.isValid || earliest.toFormat("yyyy-MM-dd'T'HH:mm:ss") !== local) throw new SchemaError(PROVIDER, 'DHLink returned an invalid scan time');
  // A row dated after the read is not a scan yet.
  if (earliest.toMillis() > readAt) return 'ahead';
  const description = wordingOf(text(row, 'info'));
  if (!description) return null;
  const code = text(row, 'nodeCode', 32);
  const name = text(row, 'nodeName', 64);
  const location = placeOf(text(row, 'place', 200));
  const staged = dhlinkStage(code, name, description);
  const event: CarrierEvent = {
    local_time: local,
    description,
    ...(location ? { location } : {}),
    ...(code ? { provider_code: code } : {}),
    ...(staged ? { stage: staged.stage, stage_source: staged.source } : {}),
  };
  const rank = [name ? 1 : 0, CJK.test(description) ? 0 : 1, location ? 1 : 0, staged ? 1 : 0, description.length];
  return { stamp: local, event, rank };
}

function outranks(left: readonly number[], right: readonly number[]): boolean {
  const index = left.findIndex((value, position) => value !== right[position]);
  return index >= 0 && left[index]! > right[index]!;
}

/** The partner's number, when its whole layout is one the table maps. */
function handoff(entry: Record<string, unknown>, asked: readonly string[]): { delivery_carrier: string; delivery_tracking_number: string } | null {
  const number = normalizeTrackingNumber(text(entry, 'lastTurnNo', 64));
  if (!number || asked.includes(number)) return null;
  const leg = DHLINK_LAST_LEGS.find((candidate) => candidate.number.test(number));
  return leg ? { delivery_carrier: leg.carrier, delivery_tracking_number: number } : null;
}

/**
 * The reply of `POST /stage-api/trbiz/track/queryTrack` for one number. The
 * search finds a parcel by its tracking number, and by other numbers of the
 * parcel too, so the parcel counts only when the number asked is its tracking
 * number or its DHLink number. Each scan comes once per feed that relays it,
 * in English or Chinese and sometimes in two formats: the rows that share a
 * clock are one scan. The order id, the feeds' ids and the row ids are not read.
 */
export function parseDhlink(payload: unknown, raw: string, readAt = Date.now()): CarrierResult {
  const number = normalizeDhlinkNumber(raw);
  if (!isRecord(payload) || typeof payload.code !== 'number') throw new SchemaError(PROVIDER, 'DHLink returned an invalid envelope');
  if (payload.code !== 200) throw new IndeterminateError(PROVIDER, 'DHLink did not complete the lookup');
  const list = isRecord(payload.data) ? payload.data.trackList : undefined;
  if (!Array.isArray(list) || list.length !== 1 || !isRecord(list[0])) throw new SchemaError(PROVIDER, 'DHLink returned an invalid parcel list');
  const entry = list[0];
  const tracking = normalizeTrackingNumber(text(entry, 'trackno', 64));
  const own = normalizeTrackingNumber(text(entry, 'logisticsNo', 64));
  const rows = entry.trackinfoList;
  // The tracker answers a number it does not know with an empty parcel and counts it not found.
  if (entry.state === STATE_NOT_FOUND && !tracking && !own && (rows === null || rows === undefined)) {
    // It answers a parcel's DHLink number the same way when the parcel has another tracking
    // number, and its last leg's number always: for those layouts the answer settles nothing.
    if (DHLINK_NUMBER.test(number)) throw new IndeterminateError(PROVIDER, 'DHLink finds a parcel by its DHLink number only when that is its tracking number');
    if (DHLINK_LAST_LEGS.some((leg) => leg.number.test(number))) throw new IndeterminateError(PROVIDER, 'DHLink does not find a parcel by the number of its last leg');
    throw new NotFoundError(PROVIDER);
  }
  if (tracking !== number && own !== number) throw new IndeterminateError(PROVIDER, 'DHLink answered with another parcel');
  if (rows === null || rows === undefined) throw new IndeterminateError(PROVIDER, 'DHLink has no scans for the parcel yet');
  if (!Array.isArray(rows)) throw new SchemaError(PROVIDER, 'DHLink returned a parcel without scans');
  if (rows.length > MAX_ROWS) throw new SchemaError(PROVIDER, 'DHLink returned an oversized history');

  const scans = new Map<string, Scan>();
  let ahead = false;
  for (const row of rows) {
    const scan = projectRow(row, readAt);
    if (scan === 'ahead') ahead = true;
    if (!scan || scan === 'ahead') continue;
    const held = scans.get(scan.stamp);
    if (!held || outranks(scan.rank, held.rank)) scans.set(scan.stamp, scan);
  }
  // Newest first, as the tracking page lists them; the clocks sort as written.
  const events = [...scans.values()].sort((left, right) => (left.stamp < right.stamp ? 1 : left.stamp > right.stamp ? -1 : 0))
    .map((scan) => scan.event);
  if (!events.length) throw new IndeterminateError(PROVIDER, 'DHLink has no scans for the parcel yet');

  const newest = events[0]!;
  const current = events.find((event) => event.stage);
  let stage = current?.stage as Stage | undefined;
  let source = current?.stage_source;
  // DHLink counts the parcel delivered even when the last feed's wording says less,
  // unless rows were written ahead of the read: then the count may be too.
  if (entry.state === STATE_DELIVERED && !ahead && stage !== 'delivered' && stage !== 'returned') {
    stage = 'delivered';
    source = 'carrier_map';
  }
  const destination = text(entry, 'destCountryCode', 8).toUpperCase();
  return {
    status: stage ? languageStageStatus(stage) : 'unknown',
    ...(stage ? { current_stage: stage, current_stage_source: source! } : {}),
    last_status_text: newest.description!,
    last_update: null,
    last_update_local: newest.local_time!,
    expected_delivery: null,
    ...handoff(entry, [number, tracking, own]),
    ...(COUNTRY.test(destination) ? { destination_country: destination } : {}),
    events: events.slice(0, MAX_EVENTS),
    ...(events.length > MAX_EVENTS ? { history_truncated: true } : {}),
  };
}
