import { DateTime } from 'luxon';
import { normalizeTrackingNumber } from '../../core/detection/index.js';
import { IndeterminateError, InvalidInputError, NoHistoryError, NotFoundError, SchemaError } from '../../core/errors/index.js';
import type { CarrierEvent, CarrierResult } from '../../core/result/index.js';
import { classifyWording, languageStageStatus, type Stage } from '../../core/status/index.js';
import { countryCode, isoTime } from '../../core/time/index.js';
import { clean, textFromHtml } from '../../core/transport/index.js';
import { isRecord } from '../../core/types.js';
import { LINHAN_NOT_FOUND, linhanMappedStage, linhanStage } from './status.js';

export const PROVIDER = 'LinHan International';
// One parcel's reply is a few kilobytes.
export const LINHAN_MAX_BYTES = 256 * 1024;
/** The tracker prints every row's wall clock on Beijing time without a zone, abroad too. */
export const LINHAN_ZONE = 'Asia/Shanghai';

// LHGJ, eight digits and CD.
const NUMBER = /^LHGJ\d{8}CD$/;
const CLOCK = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/;
const MAX_ROWS = 500;
const MAX_EVENTS = 100;

// "Arrive <Town>, at the sorting and distribution center": the town after the verb.
const ARRIVE = /^(Arrive)\s+([^,]{1,80}),\s*(at\s.+)$/i;
// A town: letters and the marks town names use, without digits.
const TOWN = /^\p{Lu}[\p{L}\p{M} .'’()-]{0,79}$/u;
// A postcode between the town and the wording: `00000`, `00-000`, `AB1 2CD`.
const POSTCODE_SEGMENT = /^(?=.*\d)[\p{Lu}\d][\p{Lu}\d -]{1,9}$/u;
// A postcode opening the segment after a region: "00000 Arrive at …" or "00000".
const POSTCODE_LEAD = /^\d{4,6}(?:-\d{4})?(?![\p{L}\p{N}])/u;
// "Town Import customs clearance": the port's town before the clearance.
const CLEARANCE = /^(.{1,80}?)\s+(import customs clearance\b.*)$/i;
// A word holding a digit next to a town, as a postcode written before it.
const DIGIT_WORD = /(?:^|\s+)\S*\d\S*/gu;
// Four to six digits standing alone are a postcode far more often than anything else.
const POSTCODE_RUN = /(^|[^\p{L}\p{N}])\d{4,6}(?![\p{L}\p{N}])/gu;
// A run of nine or more digits, with the separators phone numbers are written with; a date stays.
const PHONE = /(?<![A-Z\d])(?!\d{4}-\d{2}-\d{2}(?!\d))\+?\d(?:[\s().-]{0,2}\d){8,}(?![A-Z\d])/gi;
// Who took a delivered parcel, as a courier's delivery line can name them.
const RECEIVER = /\s*[,;:.\-–]?\s*\b(?:(?:signed|received|collected|accepted)(?:\s+for)?\s+by|signatory|signature)\b.*$/i;

/** A LinHan waybill number; anything else is not one it issues. */
export function normalizeLinhanNumber(raw: string): string {
  const number = typeof raw === 'string' && raw.length <= 64 ? normalizeTrackingNumber(raw) : '';
  if (!NUMBER.test(number)) throw new InvalidInputError(PROVIDER, 'LinHan International waybills are LHGJ, eight digits and CD');
  return number;
}

/** A town, without a postcode written beside it, or '' when the text is not one. */
function town(value: string): string {
  const name = clean(value.replace(DIGIT_WORD, ' '), 80);
  // Wording the shared rules read is a scan, not a place: "Delivery failed, …".
  return TOWN.test(name) && classifyWording(name, 'pending').source === 'none' ? name : '';
}

/** Scan text without postcodes, phone numbers or who took a delivered parcel. */
function scrub(value: string): string {
  const unsigned = /^delivered\b/i.test(value) ? value.replace(RECEIVER, '') : value;
  return clean(unsigned.replace(PHONE, ' ').replace(POSTCODE_RUN, '$1'), 300).replace(/^[\s,;:]+|[\s,;:]+$/g, '');
}

/**
 * A row's wording and place. Rows at the destination open with the town and,
 * on a delivery, the postcode: "Town, 00000, Delivered". In the United States
 * the state comes between them: "Town, State, 00000 Arrive at …". One names
 * the town after its verb: "Arrive Town, at the sorting and distribution
 * center", and the import clearance before it: "Town Import customs
 * clearance". The town, and the state with it, becomes the location and the
 * postcode is dropped; text that does not open with a town stays whole.
 */
export function linhanScan(content: string): { description: string; location: string } {
  const text = textFromHtml(content, 300);
  const arrive = ARRIVE.exec(text);
  const arrivedAt = arrive ? town(arrive[2]!) : '';
  if (arrive && arrivedAt) return { description: scrub(`${arrive[1]} ${arrive[3]}`), location: arrivedAt };
  const clearance = CLEARANCE.exec(text);
  // The destination agent's clearance names no town.
  const port = clearance && !/\b(?:agent|carrier)\b/i.test(clearance[1]!) ? town(clearance[1]!) : '';
  if (clearance && port) return { description: scrub(clearance[2]!), location: port };
  const [head = '', ...rest] = text.split(/\s*,\s*/);
  const region = rest.length > 1 && POSTCODE_LEAD.test(rest[1]!) ? town(rest[0]!) : '';
  if (region) rest.shift();
  while (rest.length && POSTCODE_SEGMENT.test(rest[0]!)) rest.shift();
  const place = rest.length ? town(head) : '';
  const description = place ? scrub(rest.join(', ')) : '';
  if (place && /\p{L}/u.test(description)) return { description, location: region ? `${place}, ${region}` : place };
  return { description: scrub(text), location: '' };
}

/** A row's clock: a wall clock to the second, with no zone. */
function wallClock(value: unknown): string {
  const match = typeof value === 'string' ? CLOCK.exec(value.trim()) : null;
  const local = match ? `${match[1]}T${match[2]}` : '';
  // Parsing in UTC checks the calendar digits only; the wall clock keeps no offset.
  const parsed = DateTime.fromISO(local, { zone: 'UTC' });
  // Luxon rolls 24:00:00 over to the next day; only a clock that reads back unchanged is kept.
  if (!match || !parsed.isValid || parsed.toFormat("yyyy-MM-dd'T'HH:mm:ss") !== local) {
    throw new SchemaError(PROVIDER, 'LinHan International returned an invalid scan time');
  }
  return local;
}

/** An optional text field; anything but a string is a changed reply. */
function text(row: Record<string, unknown>, key: string, maxLength = 300): string {
  const value = row[key];
  if (value === null || value === undefined) return '';
  if (typeof value !== 'string') throw new SchemaError(PROVIDER, `LinHan International returned an invalid ${key}`);
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
 * The reply of the tracking page's `getTrackingByNos` for one number: a JSON
 * array with an item per number asked, holding the summary's status and the
 * countries in Chinese, and the scans in English, newest first. Only the item
 * that names the whole number asked is read. A number the tracker does not
 * know gets "查询不到" and no scans.
 */
export function parseLinhan(payload: unknown, raw: string): CarrierResult {
  const number = normalizeLinhanNumber(raw);
  // The answer to a lookup without a number; it never comes for one.
  if (isRecord(payload) && payload.success === false) throw new IndeterminateError(PROVIDER, 'LinHan International did not complete the lookup');
  if (!Array.isArray(payload)) throw new SchemaError(PROVIDER, 'LinHan International returned an invalid reply');
  const items = payload.map((item: unknown) => {
    if (!isRecord(item) || typeof item.no !== 'string') throw new SchemaError(PROVIDER, 'LinHan International returned a parcel without its number');
    return item;
  });
  const bound = items.filter((item) => clean(item.no, 64) === number);
  if (bound.length !== 1) throw new SchemaError(PROVIDER, 'LinHan International did not answer for the waybill asked');
  const item = bound[0]!;
  const status = text(item, 'status', 40);
  const rows = item.details;
  if (!Array.isArray(rows)) throw new SchemaError(PROVIDER, 'LinHan International returned a parcel with invalid scans');
  if (LINHAN_NOT_FOUND.includes(status)) {
    if (rows.length) throw new SchemaError(PROVIDER, 'LinHan International returned scans for a number it does not know');
    throw new NotFoundError(PROVIDER, 'LinHan International has no parcel under this number');
  }
  if (rows.length > MAX_ROWS) throw new SchemaError(PROVIDER, 'LinHan International returned an oversized history');

  const seen = new Set<string>();
  const events: CarrierEvent[] = [];
  for (const row of rows) {
    if (!isRecord(row) || typeof row.content !== 'string') throw new SchemaError(PROVIDER, 'LinHan International returned an invalid scan');
    const local = wallClock(row.create_time);
    const { description, location } = linhanScan(row.content);
    if (!description) throw new SchemaError(PROVIDER, 'LinHan International returned a scan without wording');
    const key = JSON.stringify([local, location, description]);
    if (seen.has(key)) continue;
    seen.add(key);
    const staged = linhanStage(description);
    // A German row has come before its wall clock's instant in Berlin, so the rows abroad are on Beijing time too.
    // China keeps one offset all year: every valid wall clock is an instant there.
    events.push({
      time: isoTime(local, LINHAN_ZONE)!.iso,
      ...(location ? { location } : {}),
      description,
      ...(staged ? { stage: staged.stage, stage_source: staged.source } : {}),
    });
  }
  if (!events.length) throw new NoHistoryError(PROVIDER);

  // The tracker's order stands.
  const newest = events[0]!;
  // The newest staged scan decides; the summary's status only when no scan has a stage.
  const scanned = events.find((event) => event.stage);
  const stage = (scanned?.stage ?? linhanMappedStage(status)) as Stage | undefined;
  const destination = text(item, 'toCountry', 40);
  const country = COUNTRY_BY_NAME.get(destination) ?? countryCode(destination);
  return {
    status: stage ? languageStageStatus(stage) : 'unknown',
    ...(stage ? { current_stage: stage, current_stage_source: scanned?.stage_source ?? 'carrier_map' } : {}),
    last_status_text: newest.description!,
    last_update: newest.time!,
    expected_delivery: null,
    ...(country ? { destination_country: country } : destination ? { destination_country_name: destination } : {}),
    events: events.slice(0, MAX_EVENTS),
    ...(events.length > MAX_EVENTS ? { history_truncated: true } : {}),
  };
}
