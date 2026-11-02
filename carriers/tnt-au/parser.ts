import { load } from 'cheerio';
import { normalizeTrackingNumber } from '../../core/detection/index.js';
import { ChallengeError, IndeterminateError, NoHistoryError, NotFoundError, SchemaError } from '../../core/errors/index.js';
import type { CarrierEvent, CarrierResult } from '../../core/result/index.js';
import { languageStageStatus, type Stage } from '../../core/status/index.js';
import { calendarDay } from '../../core/time/index.js';
import { clean } from '../../core/transport/index.js';
import { normalizeTntAustraliaNumber } from './number.js';
import { tntAustraliaStage } from './status.js';

export { normalizeTntAustraliaNumber };

export const PROVIDER = 'TNT Australia';
export const CARRIER = 'tnt-au';
// A history page is a few kilobytes.
export const TNT_AUSTRALIA_MAX_BYTES = 256 * 1024;

const NUMBER = /^Consignment No:\s*(\S+)$/;
const ESTIMATE = /^Estimated Delivery by:\s*(\d{1,2})\/(\d{1,2})\/(\d{4})(?: \d{1,2}:\d{2})?$/;
const DAY = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const TIME = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;
// The tracker's answer for a number it has no consignment for.
const NO_CONSIGNMENT = /^No consignment was found$/i;
// Firewall and bot-check pages that could stand in for the tracker's own.
const BLOCK = /<title>\s*(?:Just a moment|Attention Required|Access Denied|Request Rejected|403 Forbidden)|_cf_chl_opt|cf-turnstile|challenge-platform|captcha|incapsula/i;
const MAX_ROWS = 300;
const MAX_EVENTS = 100;

/** A `dd/MM/yyyy` day as `YYYY-MM-DD`, validated. */
function dayOf(year: string, month: string, day: string): string | null {
  return calendarDay(Number(year), Number(month), Number(day));
}

/** A row's day and 24-hour clock as a wall clock; a row without a clock keeps its day. */
function wallClock(date: string, time: string): string | null {
  const day = DAY.exec(date);
  const shown = day ? dayOf(day[3]!, day[2]!, day[1]!) : null;
  if (!shown) return null;
  if (!time) return shown;
  const clock = TIME.exec(time);
  if (!clock || Number(clock[1]) > 23 || Number(clock[2]) > 59 || Number(clock[3] ?? 0) > 59) return null;
  return `${shown}T${clock[1]!.padStart(2, '0')}:${clock[2]}:${clock[3] ?? '00'}`;
}

/**
 * The consignment history TNT Australia's tracker serves at
 * `ASPs/trackref_detail.asp?con={number}`: the number, the estimated
 * delivery while one is due, and the scans oldest first, each with its
 * wording, the depot's day and clock, and the depot. A number the tracker has
 * no consignment for gets the same table with "No consignment was found".
 *
 * The page must name the whole number asked. Scan clocks are the depot's,
 * without a zone, and depots span three zones, so they stay wall clocks.
 */
export function parseTntAustralia(html: string, raw: string): CarrierResult {
  const number = normalizeTntAustraliaNumber(raw);
  const $ = load(html);
  const table = $('table#appTable');
  if (table.length !== 1 || clean($('#appPanel > h4').text(), 100) !== 'Consignment Status History') {
    if (BLOCK.test(html.slice(0, 64_000))) throw new ChallengeError(PROVIDER, 'TNT Australia answered with a browser check');
    throw new SchemaError(PROVIDER, 'TNT Australia returned an unexpected page');
  }
  const header = table.find('td.strong').map((_, cell) => clean($(cell).text(), 120)).get().filter(Boolean);
  const named = header.map((text) => NUMBER.exec(text)?.[1]).filter((value) => value !== undefined);
  if (named.length !== 1) throw new SchemaError(PROVIDER, 'TNT Australia did not name the consignment');
  if (normalizeTrackingNumber(named[0]!) !== number) throw new IndeterminateError(PROVIDER, 'TNT Australia answered for another consignment');

  const rows = table.find('tr').filter((_, row) => !$(row).find('table').length && !$(row).children('td.strong, td.heading').length);
  if (rows.length > MAX_ROWS) throw new SchemaError(PROVIDER, 'TNT Australia returned an oversized history');
  const scans: CarrierEvent[] = [];
  rows.each((_, element) => {
    const cells = $(element).children('td').map((_, cell) => clean($(cell).text(), 200)).get();
    if (cells.length === 1 && NO_CONSIGNMENT.test(cells[0]!)) throw new NotFoundError(PROVIDER);
    // The spacer row under the consignment's number.
    if (cells.length === 1 && !cells[0]) return;
    if (cells.length !== 4 || !cells[0]) throw new SchemaError(PROVIDER, 'TNT Australia returned an invalid scan');
    const [description, date, time, location] = cells as [string, string, string, string];
    const local = wallClock(date, time);
    if (!local) throw new SchemaError(PROVIDER, 'TNT Australia returned an invalid scan time');
    const staged = tntAustraliaStage(description);
    scans.push({ local_time: local, ...(location ? { location } : {}), description,
      ...(staged ? { stage: staged.stage, stage_source: staged.source } : {}) });
  });
  const headings = table.find('td.heading').map((_, cell) => clean($(cell).text(), 40)).get();
  if (headings.join('|') !== 'Status|Date|Time|Depot') throw new SchemaError(PROVIDER, 'TNT Australia history layout changed');
  if (!scans.length) throw new NoHistoryError(PROVIDER, 'TNT Australia lists the consignment without scans');

  // Oldest first, as the page lists them.
  const events = scans.reverse();
  const newest = events[0]!;
  const staged = events.find((event) => event.stage);
  const stage = staged?.stage as Stage | undefined;
  const finished = stage === 'delivered' || stage === 'returned';
  const estimate = finished ? null : header.map((text) => ESTIMATE.exec(text)).find(Boolean);
  const expected = estimate ? dayOf(estimate[3]!, estimate[2]!, estimate[1]!) : null;
  return {
    status: stage ? languageStageStatus(stage) : 'unknown',
    ...(stage ? { current_stage: stage, current_stage_source: staged!.stage_source! } : {}),
    last_status_text: newest.description!,
    last_update: null,
    last_update_local: newest.local_time!,
    expected_delivery: expected,
    events: events.slice(0, MAX_EVENTS),
    ...(events.length > MAX_EVENTS ? { history_truncated: true } : {}),
  };
}
