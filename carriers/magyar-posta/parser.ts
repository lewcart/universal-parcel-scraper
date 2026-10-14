import { load, type CheerioAPI } from 'cheerio';
import { DateTime } from 'luxon';
import { normalizeTrackingNumber } from '../../core/detection/index.js';
import { returnedTrackingNumber } from '../../core/detection/returned.js';
import { ChallengeError, IndeterminateError, InvalidInputError, NotFoundError, SchemaError } from '../../core/errors/index.js';
import type { CarrierEvent, CarrierResult } from '../../core/result/index.js';
import { lastMovement } from '../../core/result/pickup.js';
import { languageStageStatus, type Stage } from '../../core/status/index.js';
import { clean } from '../../core/transport/index.js';
import { isMagyarPostaSettlement, magyarPostaStage } from './status.js';

export const PROVIDER = 'Magyar Posta';
// A result page for one item is a few dozen kilobytes once its scripts are removed.
export const MAGYAR_POSTA_MAX_BYTES = 1_000_000;

const MAX_ROWS = 300;
// The heading of the tracker's result section, in Hungarian, the language the adapter asks for.
const RESULTS = 'Eredmények';
// The notice for a number without data: "the system found no data for the item".
const NOT_FOUND = 'A megadott küldeményre vonatkozóan a rendszer sajnos nem talált adatot';
const SERVICE = 'Küldemény típusa';
const BLOCKED = /<title>\s*(?:Request Rejected|Access Denied)|requested URL was rejected/i;
// "2026. 01. 13. 9:04": a wall clock without an offset.
const STAMP = /^(\d{4})\. (\d{2})\. (\d{2})\. (\d{1,2}):(\d{2})$/;
// The icon of a row or item: its tab (parcel, letter, other), then the category of the scan.
const CATEGORY = /^fig_[123]([1-5])$/;

type Selection = ReturnType<CheerioAPI>;

/**
 * The tracker takes S10 item codes, Magyar Posta's domestic numbers and the
 * barcodes other networks hand over: letters and digits, with at least one digit.
 */
export function normalizeMagyarPostaNumber(raw: string): string {
  const number = normalizeTrackingNumber(raw);
  if (/^(?=[A-Z]*\d)[A-Z0-9]{8,30}$/.test(number)) return number;
  throw new InvalidInputError(PROVIDER, 'Magyar Posta tracks letters and digits, 8 to 30 of them');
}

/** The public page, which frames the tracker and fills the number into its search. */
export function magyarPostaTrackingUrl(raw: string): string {
  return `https://www.posta.hu/nyomkovetes/nyitooldal?searchvalue=${normalizeMagyarPostaNumber(raw)}`;
}

function wallClock(stamp: string): string | null {
  const match = STAMP.exec(stamp);
  if (!match) return null;
  const [year, month, day, hour, minute] = match.slice(1).map(Number) as [number, number, number, number, number];
  // UTC only checks the calendar fields. No offset is assigned.
  const parsed = DateTime.fromObject({ year, month, day, hour, minute }, { zone: 'UTC' });
  return parsed.isValid ? parsed.toFormat("yyyy-MM-dd'T'HH:mm:ss") : null;
}

/** "Facility|Town" as "Facility, Town". */
function place(raw: string): string {
  const [name = '', town = '', ...rest] = raw.split('|').map(part => clean(part, 200));
  if (rest.length) return '';
  return name && town && name !== town ? `${name}, ${town}` : name || town;
}

function category($: CheerioAPI, node: Selection): string | undefined {
  const icons = node.children('div.status_ikon').children('div');
  if (icons.length !== 1) return undefined;
  return CATEGORY.exec(clean($(icons[0]).attr('class'), 20))?.[1];
}

/** The wording of a scan, without the line under it that names who took the item. */
function wording(cell: Selection): string {
  const copy = cell.clone();
  copy.find('.data_sikertelen_atv').remove();
  return clean(copy.text(), 300);
}

/**
 * The tracker's Hungarian result page for one number: the item's current
 * status, the details of a parcel and its log, oldest first, each scan with
 * its category, wording, clock and mostly a facility. A number without data
 * comes back with a notice instead.
 */
export function parseMagyarPosta(html: string, raw: string): CarrierResult {
  const number = normalizeMagyarPostaNumber(raw);
  const $ = load(html);
  const sections = $('div.result_section');
  if (sections.length !== 1) {
    if (BLOCKED.test(html.slice(0, 64_000))) throw new ChallengeError(PROVIDER, 'Magyar Posta answered with a block page');
    throw new SchemaError(PROVIDER, 'Magyar Posta did not return a search result');
  }
  const section = sections.first();
  if (clean(section.children('h2').text(), 40) !== RESULTS) throw new SchemaError(PROVIDER, 'Magyar Posta did not answer in Hungarian');
  // The search the page answers, which is one number.
  const searched = $('input#Ids');
  if (searched.length !== 1 || returnedTrackingNumber(searched.attr('value')) !== number) {
    throw new SchemaError(PROVIDER, 'Magyar Posta answered for a different search');
  }

  const items = $('div.result_item.closed');
  if (!items.length) {
    const notices = section.find('div.result_error');
    if (notices.length === 1 && returnedTrackingNumber(notices.find('b').text()) === number
      && clean(notices.find('span').first().text(), 200) === NOT_FOUND) throw new NotFoundError(PROVIDER);
    throw new IndeterminateError(PROVIDER, 'Magyar Posta returned neither an item nor its not-found notice');
  }
  // Letters carry a placeholder in data-id, so the number is read from the item's first column.
  if (items.length !== 1 || returnedTrackingNumber(items.children('div.data_1').text()) !== number) {
    throw new SchemaError(PROVIDER, 'Magyar Posta returned a different or ambiguous item');
  }
  const item = items.first();
  const opened = item.nextAll('div.result_item.opened').first();
  if (opened.length !== 1 || returnedTrackingNumber(opened.children('div.data1').text()) !== number) {
    throw new SchemaError(PROVIDER, 'Magyar Posta returned an item without its log');
  }

  const rows = opened.find('div.more_details_item');
  if (rows.length > MAX_ROWS) throw new SchemaError(PROVIDER, 'Magyar Posta returned an invalid item log');
  const scans: { event: CarrierEvent; index: number }[] = [];
  const seen = new Set<string>();
  rows.each((index, node) => {
    const row = $(node);
    const line = row.children('div.line_container');
    const code = category($, row);
    const time = wallClock(clean(line.children('div.data_more_1').text(), 40));
    const description = wording(line.children('div.data_more_3'));
    if (!code || !time || !description) throw new SchemaError(PROVIDER, 'Magyar Posta returned a scan without a category, clock or wording');
    if (isMagyarPostaSettlement(description)) return;
    const location = place(line.children('div.data_more_4').text());
    const event: CarrierEvent = { local_time: time, description, ...(location ? { location } : {}), provider_code: code };
    // A delivery can repeat a scan with the same clock, place and wording.
    const identity = JSON.stringify(event);
    if (seen.has(identity)) return;
    seen.add(identity);
    scans.push({ event, index });
  });
  // The log is oldest first. Newest first; on equal clocks, the later row first.
  scans.sort((left, right) => right.event.local_time! > left.event.local_time! ? 1
    : right.event.local_time! < left.event.local_time! ? -1 : right.index - left.index);
  const events = scans.map(({ event }) => event);

  // Oldest first: once the item is going back, a delivery reaches its sender.
  let returning = false;
  for (const event of [...events].reverse()) {
    let stage = magyarPostaStage(event.provider_code as string, event.description!);
    if (!stage) continue;
    if (stage === 'delivered' && returning) stage = 'returned';
    if (stage === 'returned') returning = true;
    Object.assign(event, { stage, stage_source: 'carrier_map' });
  }

  const current = clean(item.children('div.data_2').text(), 300);
  const latest = events[0];
  if (!latest) {
    // An item the tracker knows by its current status alone.
    const time = wallClock(clean(item.children('div.data_3').text(), 40));
    const stage = current ? magyarPostaStage(category($, item) ?? null, current) : undefined;
    if (!current || !time) throw new IndeterminateError(PROVIDER, 'Magyar Posta returned an item without a status');
    return { status: stage ? languageStageStatus(stage) : 'unknown', ...(stage ? { current_stage: stage, current_stage_source: 'carrier_map' } : {}),
      last_status_text: current, last_update: null, last_update_local: time, expected_delivery: null, summary_only: true, events: [] };
  }
  const staged = events.find(event => event.stage);
  const stage = staged?.stage as Stage | undefined;
  // The office or locker an item waits at is its pickup point. A delivered
  // item was collected there when it waited there last before the delivery.
  const earlier = events.slice(1);
  const waiting = latest.stage === 'ready_for_pickup' ? latest
    : latest.stage === 'delivered' && lastMovement(earlier) === 'ready_for_pickup'
      ? earlier.find(event => event.stage === 'ready_for_pickup') : undefined;
  const point = waiting?.location ?? '';
  // A parcel's details name its service; letters have none.
  const service = opened.find('div.details_item').filter((_, node) =>
    clean($(node).children('div.details_label').text(), 60).replace(/\s*:$/, '') === SERVICE).children('div.details_data');
  const serviceName = service.length === 1 ? clean(service.text(), 100) : '';

  return {
    status: stage ? languageStageStatus(stage) : 'unknown',
    ...(stage ? { current_stage: stage, current_stage_source: 'carrier_map' } : {}),
    last_status_text: current || latest.description!,
    last_update: null,
    last_update_local: latest.local_time!,
    expected_delivery: null,
    ...(serviceName ? { service_name: serviceName } : {}),
    ...(point ? { pickup_point: point } : {}),
    ...(events.length > 100 ? { history_truncated: true } : {}),
    events: events.slice(0, 100),
  };
}
