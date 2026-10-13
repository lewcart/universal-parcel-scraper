/**
 * Asendia tracking through Asendia UK's own tracker.
 *
 * Protocol provenance:
 * - Asendia UK (formerly wnDirect) runs https://uktracking.asendia.com/
 *   tracking.php on the group's domain; archived shipper links point to it.
 *   The page's form is a plain GET with `ref` and `submit`; the reply is
 *   server-rendered HTML with no challenge, cookie or session. `tracking-pb.php` and `tracking-dpd.php` are skins of the same
 *   search.
 * - It covers parcels Asendia UK carries, whichever post or courier delivers
 *   them, with Asendia's harmonized history. Parcels of the other European
 *   subsidiaries are not on it: their only public tracker is track.asendia.com,
 *   which needs a Turnstile token for every search (see probe.ts).
 * - The search also matches order and other references that the page does not
 *   echo, so a parcel is bound only through its echoed "Tracking Code".
 * - A number the tracker does not know answers HTTP 200 with the notice
 *   "No tracking information found". Parcels drop off the tracker some months
 *   after posting and then get the same notice.
 *
 * Clocks: event times have no offset and do not share one zone (the same scan
 * can be listed twice an hour apart), so they are kept as wall clocks in
 * `local_time`, in page order.
 *
 * Privacy: the destination block's order reference, city, state and postal
 * code are never read; only its country code is.
 */
import { load, type CheerioAPI } from 'cheerio';
import { DateTime } from 'luxon';
import { lookupBudget, type TrackingContext } from '../../core/adapter/index.js';
import { carrierIdFromPartner } from '../../core/catalog/hints.js';
import { ChallengeError, IndeterminateError, InvalidInputError, NoHistoryError, NotFoundError, SchemaError } from '../../core/errors/index.js';
import type { CarrierEvent, CarrierResult, CarrierStatus } from '../../core/result/index.js';
import { languageStageStatus, wordingStage } from '../../core/status/index.js';
import { clean, decodeText, fetchBounded, userAgentOf } from '../../core/transport/index.js';
import { classifyAsendiaUkEvent, isAsendiaUkNotice } from './status.js';

const PROVIDER = 'Asendia UK';
const PAGE_URL = 'https://uktracking.asendia.com/tracking.php';
const DEFAULT_BUDGET_MS = 15_000;
const MAX_REQUEST_MS = 10_000;
const MAX_RESPONSE_BYTES = 1_000_000;
const MAX_EVENTS_TO_INSPECT = 500;
const MAX_EVENTS_TO_RETURN = 100;
const NOT_FOUND_NOTICE = 'No tracking information found';
const HISTORY_HEADINGS = '|Description|Date';
const ASENDIA_HOST = /(?:^|\.)asendia\.(?:com|co\.uk)$/i;

type Nodes = ReturnType<CheerioAPI>;

/** Letters and digits only, upper-cased: how tracking codes are compared. */
function comparable(value: string): string {
  return value.toLocaleUpperCase('en-US').replace(/[^A-Z0-9]/g, '');
}

export function normalizeAsendiaUkTrackingNumber(raw: string): string {
  const value = comparable(clean(raw, 80));
  if (!/^[A-Z0-9]{6,40}$/.test(value)) {
    throw new InvalidInputError(PROVIDER, 'Asendia tracking numbers must contain 6 to 40 ASCII letters and digits');
  }
  return value;
}

/** The tracker's own result page for one number. */
export function asendiaUkTrackingUrl(rawTrackingNumber: string): string {
  const url = new URL(PAGE_URL);
  url.searchParams.set('ref', normalizeAsendiaUkTrackingNumber(rawTrackingNumber));
  url.searchParams.set('submit', '');
  return url.toString();
}

/** "08:09 Mon 12 Oct 2026" → "2026-10-12T08:09:00", validated without assigning a zone. */
function wallTime(raw: string): string {
  const date = /^\d{2}:\d{2} [A-Z][a-z]{2} \d{2} [A-Z][a-z]{2} \d{4}$/.test(raw)
    ? DateTime.fromFormat(raw, 'HH:mm EEE dd MMM yyyy', { zone: 'UTC', locale: 'en-US' })
    : null;
  // Luxon also rejects a weekday that does not match the date.
  if (!date?.isValid) throw new SchemaError(PROVIDER, 'Asendia UK returned an invalid event date');
  return date.toFormat("yyyy-MM-dd'T'HH:mm:ss");
}

function cellTexts($: CheerioAPI, cells: Nodes): string[] {
  return cells.map((_, cell) => clean($(cell).text(), 500)).get();
}

function historyEvents($: CheerioAPI, parcelRow: Nodes): CarrierEvent[] {
  const tables = parcelRow.next('tr').children('td.parcel-right[colspan="2"]').find('table');
  if (tables.length !== 1) throw new SchemaError(PROVIDER, 'Asendia UK returned no history table');
  const rows = tables.find('tr');
  const headings = rows.first().children('th');
  if (cellTexts($, headings).join('|') !== HISTORY_HEADINGS) {
    throw new SchemaError(PROVIDER, 'Asendia UK returned an unexpected history table');
  }
  const scans = rows.slice(1);
  if (scans.length > MAX_EVENTS_TO_INSPECT) throw new SchemaError(PROVIDER, 'Asendia UK returned too many events');
  const events: CarrierEvent[] = [];
  const seen = new Set<string>();
  for (const row of scans.toArray()) {
    const cells = $(row).children('td');
    if (cells.length !== 3 || cells.filter('[colspan], [rowspan]').length) {
      throw new SchemaError(PROVIDER, 'Asendia UK returned an invalid event row');
    }
    const [location, description, date] = cellTexts($, cells);
    if (!description) throw new SchemaError(PROVIDER, 'Asendia UK returned an empty event');
    const localTime = wallTime(date!);
    const key = JSON.stringify([localTime, description, location]);
    if (seen.has(key)) continue;
    seen.add(key);
    const classified = classifyAsendiaUkEvent(description);
    events.push({
      local_time: localTime,
      description,
      ...(location ? { location: clean(location, 200) } : {}),
      ...(classified ? { stage: classified.stage } : {}),
    });
  }
  return events;
}

/** The destination country code, the one field of the order block that is read. */
function destinationCountry($: CheerioAPI, parcelRow: Nodes): string | null {
  const order = parcelRow.closest('td.order');
  const labels = order.children('span.order-field').filter((_, field) => clean($(field).text()) === 'Country Code:');
  if (labels.length !== 1) return null;
  const value = clean(labels.next('span.order-data').text(), 8).toUpperCase();
  return /^[A-Z]{2}$/.test(value) ? value : null;
}

function deliveryCarrier(parcelRow: Nodes): string | null {
  const links = parcelRow.children('td.parcel-right').find('span.carrier-link a');
  if (links.length !== 1) return null;
  const name = clean(links.text(), 80);
  let href = clean(links.attr('href'), 500);
  try {
    // Some partners are linked through Asendia's own portal: name them by the label alone.
    if (href && ASENDIA_HOST.test(new URL(href).hostname)) href = '';
  } catch {
    href = '';
  }
  const partner = carrierIdFromPartner(name, href);
  return partner && partner !== 'asendia' ? partner : null;
}

/** Pure projection of the tracker's result page for the requested number. */
export function parseAsendiaUkTrackingPage(html: string, rawTrackingNumber: string): CarrierResult {
  const number = normalizeAsendiaUkTrackingNumber(rawTrackingNumber);
  const $ = load(html);
  if (/just a moment|attention required|access denied|captcha/i.test($('title').text())
    || $('.g-recaptcha, .h-captcha, .cf-turnstile, iframe[src*="captcha"]').length) throw new ChallengeError(PROVIDER);
  $('script, style, noscript').remove();
  const results = $('div#tracking-results').first();
  if ($('form#subForm input[name="ref"]').length !== 1 || results.length !== 1) {
    throw new SchemaError(PROVIDER, 'Asendia UK returned an unexpected page');
  }
  const parcels = results.find('td.parcel-left');
  const notices = results.find('h3').filter((_, heading) => clean($(heading).text()) === NOT_FOUND_NOTICE);
  if (!parcels.length) {
    if (notices.length === 1) throw new NotFoundError(PROVIDER);
    throw new SchemaError(PROVIDER, 'Asendia UK did not answer the search');
  }
  if (notices.length) throw new SchemaError(PROVIDER, 'Asendia UK returned parcels and a not-found notice');
  const matches = parcels.filter((_, cell) => {
    const parcel = /^Parcel: \d+ of \d+ Tracking Code: (\S{1,60})$/.exec(clean($(cell).text(), 200));
    if (!parcel) throw new SchemaError(PROVIDER, 'Asendia UK returned an invalid parcel');
    return comparable(parcel[1]!) === number;
  });
  // The search matched another reference, such as an order number: the page
  // names no parcel this number identifies.
  if (!matches.length) throw new IndeterminateError(PROVIDER, 'Asendia UK listed parcels under other tracking codes');
  if (matches.length > 1) throw new SchemaError(PROVIDER, 'Asendia UK listed the tracking code more than once');
  const parcelRow = matches.closest('tr');
  const events = historyEvents($, parcelRow);
  if (!events.length) throw new NoHistoryError(PROVIDER);
  // Newest first on the page. Clocks are not sorted: they do not share a zone.
  const current = events.find((event) => !isAsendiaUkNotice(event.description!)) ?? events[0]!;
  const explicit = classifyAsendiaUkEvent(current.description!);
  const stage = explicit?.stage ?? wordingStage(current.description!);
  const status: CarrierStatus = explicit?.status ?? languageStageStatus(stage);
  const country = destinationCountry($, parcelRow);
  const partner = deliveryCarrier(parcelRow);
  return {
    status,
    ...(explicit ? { current_stage: explicit.stage } : {}),
    last_status_text: current.description!,
    last_update: null,
    last_update_local: events[0]!.local_time,
    expected_delivery: null,
    ...(country ? { destination_country: country } : {}),
    ...(partner ? { delivery_carrier: partner } : {}),
    events: events.slice(0, MAX_EVENTS_TO_RETURN),
  };
}

export interface AsendiaUkTrackerOptions {
  /** Test seam; production uses the global fetch. */
  fetcher?: typeof fetch;
  budgetMs?: number;
  userAgent?: string;
}

export class AsendiaUkTracker {
  private readonly fetcher?: typeof fetch;
  private readonly budgetMs: number;
  private readonly userAgent: string;

  constructor(options: AsendiaUkTrackerOptions = {}) {
    this.fetcher = options.fetcher;
    this.budgetMs = options.budgetMs ?? DEFAULT_BUDGET_MS;
    if (!Number.isFinite(this.budgetMs) || this.budgetMs <= 0) throw new TypeError('Asendia UK budget must be positive');
    this.userAgent = userAgentOf(options.userAgent);
  }

  async fetch(rawTrackingNumber: string, context: TrackingContext = {}): Promise<CarrierResult> {
    const trackingNumber = normalizeAsendiaUkTrackingNumber(rawTrackingNumber);
    const budget = lookupBudget(context, this.budgetMs, PROVIDER);
    const url = asendiaUkTrackingUrl(trackingNumber);
    const { bytes } = await fetchBounded(url, {
      signal: budget.signal,
      headers: { Accept: 'text/html', 'User-Agent': this.userAgent },
    }, {
      provider: 'Asendia UK tracker', timeoutMs: Math.min(MAX_REQUEST_MS, budget.remainingMs()),
      maxBytes: MAX_RESPONSE_BYTES, fetcher: this.fetcher,
    });
    const result = parseAsendiaUkTrackingPage(decodeText(bytes), trackingNumber);
    result.tracking_url = url;
    result.tracking_source = 'rendered-page';
    return result;
  }
}
