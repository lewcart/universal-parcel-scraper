import { load } from 'cheerio';
import { DateTime } from 'luxon';
import { normalizeTrackingNumber } from '../../core/detection/index.js';
import { ChallengeError, IndeterminateError, InvalidInputError, NoHistoryError, NotFoundError, SchemaError } from '../../core/errors/index.js';
import type { CarrierEvent, CarrierResult } from '../../core/result/index.js';
import { languageStageStatus, type Stage } from '../../core/status/index.js';
import { clean } from '../../core/transport/index.js';
import { jsExpressStage } from './status.js';

export const PROVIDER = 'JS Express';
// The page is under 100 kB with a long history.
export const JS_EXPRESS_MAX_BYTES = 1024 * 1024;

// JSE, two letters, ten digits and YQ.
const NUMBER = /^JSE[A-Z]{2}\d{10}YQ$/;
const CLOCK = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/;
// The page's answers in place of scans: an unknown number, and, in its script, a known one without scans.
const NOT_FOUND = '未获取到任何数据';
const NO_SCANS = '暂无轨迹数据';
// The image captcha the page's own query button asks for, should the server ask it of the form.
const CAPTCHA = /验证码/;
// A firewall or bot check's page, which can come back with HTTP 200. The tracking page itself
// loads Cloudflare's scripts and carries the captcha dialog's markup, so only a page without the
// tracker's form is read for these.
const BLOCKED = /_cf_chl_opt|cf-turnstile|<title>\s*(?:Just a moment|Attention Required|Access denied)|g-recaptcha|geetest/i;
// A run of nine or more digits, with the separators phone numbers are written with; a date stays.
const PHONE = /(?<![A-Z\d])(?!\d{4}-\d{2}-\d{2}(?!\d))\+?\d(?:[\s().-]{0,2}\d){8,}(?![A-Z\d])/gi;
// Who took a delivered parcel, as a courier's delivery line can name them.
const RECEIVER = /\s*[,;:.\-–]?\s*\b(?:(?:signed|received|collected|accepted)(?:\s+for)?\s+by|signed|signatory|signature)\b.*$/i;
// The place a destination courier's wording ends with, as "Delivered (Sample Town, ON)".
const PLACE = /\s*\(([^()]{1,120})\)$/;
const MAX_ROWS = 500;
const MAX_EVENTS = 100;

/** A JS Express waybill number; anything else is not one it issues. */
export function normalizeJsExpressNumber(raw: string): string {
  const number = raw.length <= 64 ? normalizeTrackingNumber(raw) : '';
  if (!NUMBER.test(number)) throw new InvalidInputError(PROVIDER, 'JS Express waybills are JSE, two letters, ten digits and YQ');
  return number;
}

/**
 * A row's wording and place. The place is the page's 【…】 label, which a
 * destination courier's wording repeats with its province, "(Sample Town,
 * ON)": the wording then loses it and the place takes it. A delivery loses a
 * clause naming who took it, and every row loses phone numbers.
 */
export function jsExpressScan(status: string, address: string): { description: string; location: string } {
  let description = clean(status, 300);
  let location = clean(address, 120);
  const place = PLACE.exec(description);
  if (place && location && clean(place[1]).toLowerCase().startsWith(location.toLowerCase())) {
    description = description.slice(0, place.index);
    location = clean(place[1], 120);
  }
  if (/^delivered\b/i.test(description)) description = description.replace(RECEIVER, '');
  return { description: clean(description.replace(PHONE, '')).replace(/[\s,;:-]+$/, ''), location: clean(location.replace(PHONE, '')) };
}

/** A row's clock: the scanning site's wall clock to the second, with no zone. */
function wallClock(stamp: string): string {
  const match = CLOCK.exec(stamp);
  const local = match ? `${match[1]}T${match[2]}` : '';
  // Parsing in UTC checks the calendar digits only; the wall clock keeps no offset.
  const parsed = DateTime.fromISO(local, { zone: 'UTC' });
  // Luxon rolls 24:00:00 over to the next day; only a clock that reads back unchanged is kept.
  if (!match || !parsed.isValid || parsed.toFormat("yyyy-MM-dd'T'HH:mm:ss") !== local) {
    throw new SchemaError(PROVIDER, 'JS Express returned an invalid scan time');
  }
  return local;
}

/**
 * The tracking page `index.php?page=19` answers the form with, for one
 * number: the form again with the number filled in, then the scans newest
 * first by wall clock, each a time, a place in 【…】 and a wording. An unknown
 * number gets "未获取到任何数据,请提供有效单号!" in place of the scans.
 */
export function parseJsExpress(html: string, rawNumber: string): CarrierResult {
  const number = normalizeJsExpressNumber(rawNumber);
  const $ = load(html);
  const field = $('input#card_num');
  const list = $('div.cxbox ul.cxlistbox');
  if (field.length !== 1 || list.length !== 1) {
    if (BLOCKED.test(html.slice(0, 64_000))) throw new ChallengeError(PROVIDER, 'JS Express answered with a block page');
    throw new SchemaError(PROVIDER, 'JS Express did not return its tracking page');
  }
  const echoed = clean(field.attr('value'), 64);
  if (!echoed) throw new IndeterminateError(PROVIDER, 'JS Express returned its page without the number');
  if (normalizeTrackingNumber(echoed) !== number) throw new SchemaError(PROVIDER, 'JS Express answered for another waybill');

  const rows = list.children('li');
  if (!rows.length) {
    const notice = clean(list.clone().children('p.bian2').remove().end().text(), 200);
    if (notice.startsWith(NOT_FOUND)) throw new NotFoundError(PROVIDER);
    if (notice.startsWith(NO_SCANS)) throw new NoHistoryError(PROVIDER);
    if (CAPTCHA.test(notice)) throw new ChallengeError(PROVIDER, 'JS Express asked for its captcha');
    if (!notice) throw new IndeterminateError(PROVIDER, 'JS Express returned its page without an answer');
    throw new SchemaError(PROVIDER, 'JS Express returned an unexpected notice');
  }
  if (rows.length > MAX_ROWS) throw new SchemaError(PROVIDER, 'JS Express returned an oversized history');

  const seen = new Set<string>();
  const events: CarrierEvent[] = [];
  for (const node of rows.toArray()) {
    const row = $(node);
    const time = row.find('p.time');
    const addr = row.find('p.addr');
    const wording = addr.children('span');
    if (time.length !== 1 || addr.length !== 1 || wording.length !== 1) throw new SchemaError(PROVIDER, 'JS Express history changed');
    const label = /^【([^】]*)】$/.exec(clean(addr.clone().children('span').remove().end().text(), 200));
    if (!label) throw new SchemaError(PROVIDER, 'JS Express history changed');
    const local = wallClock(clean(time.text(), 32));
    const { description, location } = jsExpressScan(wording.text(), label[1]!);
    if (!description) throw new SchemaError(PROVIDER, 'JS Express returned a scan without wording');
    const key = JSON.stringify([local, location, description]);
    if (seen.has(key)) continue;
    seen.add(key);
    const staged = jsExpressStage(description);
    events.push({
      local_time: local,
      ...(location ? { location } : {}),
      description,
      ...(staged ? { stage: staged.stage, stage_source: staged.source } : {}),
    });
  }

  // The page's order stands: a history mixes the clocks of several countries.
  const newest = events[0]!;
  const current = events.find((event) => event.stage);
  const stage = current?.stage as Stage | undefined;
  return {
    status: stage ? languageStageStatus(stage) : 'unknown',
    ...(stage ? { current_stage: stage, current_stage_source: current!.stage_source } : {}),
    last_status_text: newest.description!,
    last_update: null,
    last_update_local: newest.local_time!,
    expected_delivery: null,
    events: events.slice(0, MAX_EVENTS),
    ...(events.length > MAX_EVENTS ? { history_truncated: true } : {}),
  };
}
