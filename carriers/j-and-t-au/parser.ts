import { DateTime } from 'luxon';
import { normalizeTrackingNumber } from '../../core/detection/index.js';
import { IndeterminateError, InvalidInputError, NoHistoryError, NotFoundError, RateLimitedError, SchemaError } from '../../core/errors/index.js';
import type { CarrierEvent, CarrierResult } from '../../core/result/index.js';
import { languageStageStatus, type Stage } from '../../core/status/index.js';
import { clean } from '../../core/transport/index.js';
import { isRecord } from '../../core/types.js';
import { jAndTAuStage } from './status.js';

export const PROVIDER = 'J&T Express Australia';
// A long history is a few kilobytes.
export const J_AND_T_AU_MAX_BYTES = 512 * 1024;
// The waybill J&T Express Australia prints: JTAU and twelve digits.
const NUMBER = /^JTAU\d{12}$/;
const WALL_CLOCK = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/;
// The page reads a reply as an answer only with this code.
const ANSWERED = 1;
// A signature that does not check out, and missing or invalid parameters: the lookup no longer takes the request as sent.
const REFUSED_REQUEST = new Set([999001010, 999001030, 999001031]);
const THROTTLED = /too many|too frequent|frequently|rate limit|请求(?:过于)?频繁|访问(?:过于)?频繁/i;
// Fields that could name the waybill a scan belongs to.
const IDENTITY = ['waybillNo', 'billCode', 'keyword'] as const;
const MAX_ROWS = 500;
const MAX_EVENTS = 100;

/** A waybill for J&T Express Australia's tracker, in upper case as it prints them; anything else is not one it issues. */
export function normalizeJAndTAuNumber(raw: string): string {
  const number = raw.length <= 64 ? normalizeTrackingNumber(raw).toUpperCase() : '';
  if (!NUMBER.test(number)) throw new InvalidInputError(PROVIDER, 'J&T Express Australia waybills are JTAU and twelve digits');
  return number;
}

// The page sets text in 【】 apart; like square brackets, it can hold a person, a phone or a branch.
const BRACKETED = /【[^】]{0,200}】|\[[^\]]{0,200}\]/gu;
// The customer service line some scans end with: "Customer service: 13 00 00", "客服热线：130000".
const HOTLINE = /\s*(?:customer\s+service(?:\s+(?:hotline|number))?|(?:官网)?客服(?:热线|电话)?)\s*[:：]?\s*\+?\d[\d\s-]*\d/giu;
// Who signed for, received or collected the parcel, to the end of the sentence: "signed for by Sample Person".
const RECEIVER = /\b((?:signed(?:\s+for)?|received|collected)\s+)by\b[^.。;；]*/giu;
const ROLES = 'courier|driver|rider|recipient|receiver|consignee|signer|signatory|sender|contact';
// A role followed by its person, after a colon or in brackets: "Courier: Sample Person", "driver (Sample Person)".
const PERSON = String.raw`(?:\s*[:：][^.。;；,，]*|(?:\s*(?:\([^)]{0,200}\)|（[^）]{0,200}）))+)`;
const NAMED = new RegExp(String.raw`\b(${ROLES})${PERSON}`, 'giu');
const NAMED_ZH = new RegExp(String.raw`(签收人|收件人|寄件人|派件员|快递员|业务员|派送员|收派员|司机|联系人)${PERSON}`, 'gu');
// A role left alone as the last sentence once its person is gone.
const BARE_ROLE = new RegExp(String.raw`(?<=[.。])\s*(?:${ROLES})\s*[.。]?$`, 'iu');
// A run of eight or more digits, with spaces, brackets, dots or hyphens between them, as phone numbers are written; a date stays.
const PHONE = /(?<![A-Z\d])(?!\d{4}-\d{2}-\d{2}(?!\d))\+?\d(?:[\s().-]{0,2}\d){7,}(?![A-Z\d])/giu;

/**
 * A scan's sentence without the people and phones it can name: anything in
 * brackets, the customer service line, who signed for the parcel, a person
 * after their role, and phone numbers.
 */
export function jAndTAuWording(sentence: string): string {
  return clean(sentence.replace(BRACKETED, ' ').replace(HOTLINE, '').replace(RECEIVER, '$1').replace(NAMED, '$1')
    .replace(NAMED_ZH, '$1').replace(PHONE, '').replace(/\(\s*\)|（\s*）/gu, '').replace(/\s+([,.;:!?，。；：])/gu, '$1'))
    .replace(/([,;:，；：])(?=[.。])/gu, '').replace(BARE_ROLE, '').replace(/^[\s,;:，；：\-–]+|[\s,;:，；：\-–]+$/gu, '');
}

/** Any waybill a record names must be the one asked. */
function checkIdentity(record: Record<string, unknown>, number: string): void {
  for (const key of IDENTITY) {
    const value = record[key];
    if (value === null || value === undefined || value === '') continue;
    if (typeof value !== 'string') throw new SchemaError(PROVIDER, `J&T Express Australia returned an invalid ${key}`);
    // The whole value, normalized: a different waybill's suffix must not be cut off before comparing.
    if (normalizeTrackingNumber(value).toUpperCase() !== number) {
      throw new IndeterminateError(PROVIDER, 'J&T Express Australia answered for another waybill');
    }
  }
}

/** A scan's instant: `scanTime`, which the reply writes in the zone the request named, UTC. */
function scanTime(row: Record<string, unknown>): string {
  const match = WALL_CLOCK.exec(typeof row.scanTime === 'string' ? row.scanTime.trim() : '');
  const clock = match ? `${match[1]}T${match[2]}` : '';
  const parsed = DateTime.fromISO(clock, { zone: 'UTC' });
  // Luxon rolls 24:00 over to the next day; only a clock that reads back unchanged is kept.
  if (!match || !parsed.isValid || parsed.toFormat("yyyy-MM-dd'T'HH:mm:ss") !== clock) {
    throw new SchemaError(PROVIDER, 'J&T Express Australia returned an invalid scan time');
  }
  return parsed.toISO({ suppressMilliseconds: true });
}

/** One scan: its instant and its sentence. A sentence that named only people or phones is no scan. */
function projectRow(row: Record<string, unknown>, number: string): { key: string; event: CarrierEvent } | null {
  checkIdentity(row, number);
  if (typeof row.customerTracking !== 'string' || !clean(row.customerTracking)) {
    throw new SchemaError(PROVIDER, 'J&T Express Australia returned a scan without wording');
  }
  const time = scanTime(row);
  const description = jAndTAuWording(clean(row.customerTracking, 1000)).slice(0, 300);
  if (!description) return null;
  const staged = jAndTAuStage(description);
  const event: CarrierEvent = {
    time,
    description,
    ...(staged ? { stage: staged.stage, stage_source: staged.source } : {}),
  };
  return { key: JSON.stringify([time, description]), event };
}

/** The refusal or failure a reply that is not an answer stands for. */
function failure(payload: Record<string, unknown>): Error {
  const message = clean(payload.msg, 200);
  if (THROTTLED.test(message)) return new RateLimitedError(PROVIDER, undefined, 'J&T Express Australia refused more lookups for now');
  if (typeof payload.code === 'number' && REFUSED_REQUEST.has(payload.code)) {
    return new SchemaError(PROVIDER, 'J&T Express Australia refused the lookup’s signature or parameters');
  }
  return new IndeterminateError(PROVIDER, 'J&T Express Australia did not complete the lookup');
}

/**
 * The reply of `getDetailByWaybillNo` for one waybill: code 1 with one answer
 * in `data` per waybill it knows, which names the waybill in `keyword` and
 * lists its scans in `details`. A waybill it does not know is left out, and
 * the page then says it has no tracking records: not found.
 */
export function parseJAndTAu(payload: unknown, raw: string): CarrierResult {
  const number = normalizeJAndTAuNumber(raw);
  if (!isRecord(payload) || typeof payload.code !== 'number') throw new SchemaError(PROVIDER, 'J&T Express Australia returned an invalid envelope');
  if (payload.code !== ANSWERED) throw failure(payload);
  const answers = payload.data;
  if (!Array.isArray(answers)) throw new SchemaError(PROVIDER, 'J&T Express Australia returned invalid answers');
  for (const answer of answers) {
    if (!isRecord(answer) || typeof answer.keyword !== 'string' || !answer.keyword) {
      throw new SchemaError(PROVIDER, 'J&T Express Australia did not name the waybill it answered for');
    }
    checkIdentity(answer, number);
  }
  if (answers.length > 1) throw new SchemaError(PROVIDER, 'J&T Express Australia returned more than one answer for the waybill');
  const answer = answers[0] as Record<string, unknown> | undefined;
  if (!answer) throw new NotFoundError(PROVIDER);
  const rows = answer.details ?? [];
  if (!Array.isArray(rows)) throw new SchemaError(PROVIDER, 'J&T Express Australia returned invalid scans');
  if (rows.length > MAX_ROWS) throw new SchemaError(PROVIDER, 'J&T Express Australia returned an oversized history');

  const seen = new Set<string>();
  const scans: { index: number; event: CarrierEvent }[] = [];
  for (const row of rows) {
    if (!isRecord(row)) throw new SchemaError(PROVIDER, 'J&T Express Australia returned an invalid scan');
    const scan = projectRow(row, number);
    if (!scan || seen.has(scan.key)) continue;
    seen.add(scan.key);
    scans.push({ index: scans.length, event: scan.event });
  }
  // A waybill the tracker knows without a scan has no history.
  if (!scans.length) throw new NoHistoryError(PROVIDER);
  // Newest first, as the page sorts them by time; scans at one time keep the reply's order.
  const clock = (event: CarrierEvent) => event.time as string;
  const newestFirst = scans.sort((a, b) => clock(b.event).localeCompare(clock(a.event)) || a.index - b.index).map(({ event }) => event);

  const newest = newestFirst[0]!;
  const staged = newestFirst.find((event) => event.stage);
  const stage = staged?.stage as Stage | undefined;
  return {
    status: stage ? languageStageStatus(stage) : 'unknown',
    ...(stage ? { current_stage: stage, current_stage_source: staged!.stage_source! } : {}),
    last_status_text: newest.description!,
    last_update: newest.time!,
    expected_delivery: null,
    ...(stage === 'delivered' ? { delivered_at: staged!.time! } : {}),
    events: newestFirst.slice(0, MAX_EVENTS),
    ...(newestFirst.length > MAX_EVENTS ? { history_truncated: true } : {}),
  };
}
