
/**
 * Ship24 (ship24.com), a universal aggregator and the first discovery
 * provider.
 *
 * Two tiers: `direct` is one signed anonymous JSON POST per lookup (see
 * http.ts), `browser` loads the public tracking page in a local Chromium
 * session and reads the same API response from it. The browser tier only runs
 * when a Chromium is configured and the direct tier failed for a reason a
 * browser can repair: a rate limit or a server outage is reported as it is, so
 * the router's backoff is not amplified into a second request, and a number
 * the aggregator does not know stays unknown to the page that asks the same
 * API.
 */
import { DateTime } from 'luxon';
import type { AdapterFactory } from '../../core/adapter/index.js';
import { IndeterminateError, NoHistoryError, SchemaError, UpstreamHttpError } from '../../core/errors/index.js';
import { runSteps } from '../../core/runner/index.js';
import type { CarrierEvent, CarrierResult } from '../../core/result/index.js';
import type { StepRecorder } from '../../core/telemetry/index.js';
import { scrapeUniversalPage, type UniversalBrowserOptions } from '../../core/transport/browser.js';
import { canadaProvinceTimeZone, countryCode, countryTimeZone, regionHasTown, sharedClockZone, usStateTimeZone } from '../../core/time/index.js';
import { isRecord } from '../../core/types.js';
import { trackingPlace } from '../../places/trackingLocation.js';
import { courierZone, universalCarrierHints } from '../shared/hints.js';
import { localEvent, numberOf, place, result, type UniversalSource } from '../shared/result.js';
import { Ship24HttpClient } from './http.js';

const SOURCE: UniversalSource = 'Ship24';
const MAX_EVENTS = 1000;
const MAX_COURIERS = 20;
/**
 * What the browser keeps of the budget when the direct tier fails: enough to
 * load the page and read a parcel Ship24 already holds. A slow direct answer
 * is Ship24 querying the carriers, which the page would only start again.
 */
const BROWSER_RESERVE_MS = 10_000;
/** How long a refresh may keep a stored history waiting; most take a few seconds, a stuck carrier query 30. */
const REFRESH_MS = 15_000;

const POSTAL_CODE = /\s*\b(?:\d{5}(?:-\d{4})?|[A-Z]\d[A-Z] ?\d[A-Z]\d)$/i;

/**
 * The clock of the US state or Canadian province a location names ("NORTH
 * YORK, ON", "Des Plaines, IL 60018", "Chicago, IL, US"). A code that is also
 * a country's ("IL" is Israel) needs the town to lie in the state, or the
 * country named after it. Any other code needs a scan in North America: an
 * Italian province ("MILANO MI") is no state.
 */
function regionZone(location: string, northAmerican: boolean): string | null {
  const parts = location.split(',').map((part) => part.trim()).filter(Boolean);
  const last = parts.at(-1) ?? '';
  // "CA" after a province is Canada; after a town it is California.
  const country = parts.length > 1 && /^(?:us|usa|united states(?: of america)?)$/i.test(last) ? 'US'
    : (parts.length > 1 && /^canada$/i.test(last)) || (parts.length > 2 && /^ca$/i.test(last)) ? 'CA' : null;
  if (country) parts.pop();
  if (parts.length > 1 && !parts.at(-1)!.replace(POSTAL_CODE, '')) parts.pop();
  const words = (parts.at(-1) ?? '').replace(POSTAL_CODE, '').split(/\s+/);
  const code = parts.length > 1 ? (words.length === 1 ? words[0]! : '') : words.length > 1 ? words.at(-1)! : '';
  const town = parts.length > 1 ? parts.at(-2)! : words.slice(0, -1).join(' ');
  const zone = (country === 'CA' ? null : usStateTimeZone(code)) ?? (country === 'US' ? null : canadaProvinceTimeZone(code));
  if (!zone) return null;
  return country || regionHasTown(code, town) || (northAmerican && !countryCode(code)) ? zone : null;
}

/** A scan location's clock: the single clock of the country it names, else of its US state or Canadian province. */
function locationZone(location: unknown, northAmerican: boolean): string | null {
  if (typeof location !== 'string' || !location.trim()) return null;
  const country = trackingPlace(location).country;
  return (country ? countryTimeZone(country) : null) ?? regionZone(location, northAmerican);
}

/** A country code Ship24 gives, which can be the retired "UK". */
function replyCountry(value: unknown): string | null {
  return typeof value === 'string' ? countryCode(value.trim().toUpperCase() === 'UK' ? 'GB' : value) : null;
}

/**
 * UPU events (EMSEVT) by the side of the border they happen on: the origin
 * post's until the item leaves its outward office of exchange, the
 * destination post's from its inward office on. National posts report them in
 * these words too.
 */
const UPU_ORIGIN = new Set(['posting/collection', 'arrival at outward office of exchange', 'departure from outward office of exchange',
  'dispatch from outward office of exchange', 'item held at outward office of exchange', 'item presented to export customs/security',
  'item held by export customs/security', 'item returned from export customs/security']);
const UPU_DESTINATION = new Set(['arrival at inward office of exchange', 'item held at inward office of exchange',
  'departure from inward office of exchange', 'item presented to import customs', 'held by import customs', 'held by customs',
  'item returned from customs (import)', 'item into sorting centre', 'item out of sorting centre', 'item held at delivery depot',
  'arrival at delivery office', 'item out for physical delivery', 'item arrival at collection point for pick-up', 'final delivery']);
const RETURNED = /\breturn(?:ed)? to sender\b/i;

/** Where the reply says the parcel travels, for the clocks its scans may keep. */
interface Journey {
  number: string;
  couriers: string[];
  origin: string | null;
  destination: string | null;
  /**
   * The origin, when an S10 suffix does not name another post: Asendia's
   * Swiss numbers are posted at Swiss Post's offices of exchange abroad.
   */
  postOrigin: string | null;
  /** The one country of a parcel that starts and ends there. */
  domestic: string | null;
  /** Whether the parcel crosses a border, so a relay can name a scan abroad as its own. */
  international: boolean;
  /** Whether the parcel starts or ends in the US or Canada. */
  northAmerican: boolean;
  /** The first wall time the item was sent back, after which its UPU events run the other way. */
  returned: string | null;
  fallback: string | null;
}

function journeyOf(data: Record<string, unknown>, events: unknown[], number: string, couriers: string[], fallback: string | null): Journey {
  // An S10 item's suffix is its origin post's country.
  const suffix = /^[A-Z]{2}\d{9}[A-Z]{2}$/.test(number) ? replyCountry(number.slice(-2)) : null;
  const origin = replyCountry(data.origin_country_code) ?? suffix;
  const destination = replyCountry(data.destination_country_code);
  const returned = events.flatMap((scan) => isRecord(scan) && typeof scan.status === 'string' && RETURNED.test(scan.status)
    && typeof scan.timestamp === 'string' ? [scan.timestamp.slice(0, 19)] : []).sort()[0] ?? null;
  return { number, couriers, origin, destination, fallback, returned,
    postOrigin: !suffix || suffix === origin ? origin : null,
    domestic: origin && origin === destination ? origin : null,
    international: Boolean(origin && destination && origin !== destination),
    northAmerican: [origin, destination].some((country) => country === 'US' || country === 'CA') };
}

/** The clock of the country a UPU event's words place it in, for an item on its way out. */
function upuZone(journey: Journey, scan: Record<string, unknown>, wall: string): string | null {
  if (!journey.international || typeof scan.status !== 'string' || (journey.returned && wall > journey.returned)) return null;
  const status = scan.status.trim().toLowerCase();
  const country = UPU_ORIGIN.has(status) ? journey.postOrigin
    : UPU_DESTINATION.has(status) || status.startsWith('unsuccessful delivery') ? journey.destination : null;
  return country ? countryTimeZone(country) : null;
}

/**
 * The zone of a scan whose timestamp names no offset: it is the scanning
 * carrier's wall clock. Its location's clock comes first, then the country of
 * a parcel that never leaves it, then the side of the border a UPU event's
 * words name. A courier name is the feed that relayed the scan, not where it
 * happened: a national post relays the destination's scans under its own
 * name. So for a parcel that crosses a border, those are all. Otherwise the
 * clock every courier the reply names keeps at that moment (La Poste and its
 * Chronopost leg) follows, else the zone routing passes for the parcel's
 * carrier. With none of them it stays a wall time, which the timeline cannot
 * place.
 */
function wallZone(journey: Journey, scan: Record<string, unknown>, wall: string): string | null {
  const courier = isRecord(scan.courier) ? replyCountry(scan.courier.country_code) : null;
  const located = locationZone(scan.location, journey.northAmerican || courier === 'US' || courier === 'CA')
    ?? (journey.domestic ? countryTimeZone(journey.domestic) : null) ?? upuZone(journey, scan, wall);
  if (located || journey.international) return located;
  const zones = journey.couriers.map((name) => courierZone(name, journey.number, wall));
  const named = zones.length && zones.every((zone): zone is string => zone !== null) ? sharedClockZone(zones, wall) : null;
  return named ?? journey.fallback;
}

export function parseShip24Response(payload: unknown, trackingNumber: string, timezone: string | null = null): CarrierResult {
  const number = numberOf(trackingNumber);
  const data = isRecord(payload) && isRecord(payload.data) ? payload.data : null;
  if (!data || data.tracking_number !== number || data.error
    || (data.events !== undefined && (!Array.isArray(data.events) || data.events.length > MAX_EVENTS))) {
    throw new SchemaError(SOURCE, 'Ship24 has no matching shipment history');
  }
  // Ship24 knows the parcel but holds no scan: it has yet to query the
  // carriers (`to_updated`), or it did and they had nothing.
  if (!Array.isArray(data.events) || !data.events.length) {
    if (data.to_updated === true) throw new IndeterminateError(SOURCE, 'Ship24 has not queried the carriers for the shipment yet');
    throw new NoHistoryError(SOURCE, 'Ship24 found the shipment but no scans for it yet');
  }
  // The public frontend renders couriers[].translation.name. Keep names only;
  // website/phone fields and alternate numbers are not needed for discovery.
  const couriers = Array.isArray(data.couriers) ? data.couriers.slice(0, MAX_COURIERS) : [];
  const names = universalCarrierHints(couriers.map((courier) =>
    isRecord(courier) && isRecord(courier.translation) ? courier.translation.name : undefined), number);
  const journey = journeyOf(data, data.events, number, names.reported_carriers, timezone);
  const events: CarrierEvent[] = [];
  for (const raw of data.events) {
    if (!isRecord(raw)) throw new SchemaError(SOURCE, 'Ship24 returned an invalid event');
    // A scan dated without a time (GLS Italy's announcement) has no place
    // among the others; it is left out rather than failing the history.
    if (typeof raw.timestamp === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.timestamp)) continue;
    // datetime can end in Z while still containing the carrier's local time.
    // timestamp carries the real offset (verified against the public web app),
    // except for some carrier legs (Chronopost) that omit it entirely.
    const parsed = localEvent(raw.timestamp, raw.status, raw.dispatch_code_id === 7 ? 'Delivered' : undefined);
    if (!parsed) continue;
    const location = place(raw.location);
    if (location) parsed.location = location;
    const wall = typeof parsed.local_time === 'string' ? parsed.local_time : null;
    const zone = wall ? wallZone(journey, raw, wall) : null;
    const instant = wall && zone ? DateTime.fromISO(wall, { zone }) : null;
    if (instant?.isValid) {
      const timed: CarrierEvent = { ...parsed, time: instant.toUTC().toISO() };
      delete timed.local_time;
      events.push(timed);
    } else events.push(parsed);
  }
  return { ...result(events, SOURCE), ...names };
}

/**
 * A browser cannot repair a rate limit or a server outage: keep the original
 * status and Retry-After for the router's backoff instead of asking twice.
 * Nor can it find a parcel the API answered 404 for, or scans Ship24 said it
 * has none of: the page asks the same API and shows the same answer.
 */
function browserCanRecover(error: unknown): boolean {
  return !(error instanceof NoHistoryError) && !(error instanceof UpstreamHttpError
    && (error.status === 404 || error.status === 410 || error.status === 429 || error.status >= 500));
}

/**
 * The parcel as the web app shows it: the stored record, refreshed when it
 * says `to_updated`. The refresh is Ship24 querying the carriers again. If it
 * fails or is slow, a stored history stands, as on the website; a record with
 * no scans yet is no answer, so the refresh's failure is.
 */
async function currentParcel(http: Ship24HttpClient, number: string, budgetMs: number, signal?: AbortSignal): Promise<unknown> {
  const deadline = performance.now() + budgetMs;
  const left = () => Math.max(1, Math.floor(deadline - performance.now()));
  const stored = await http.fetch(number, left(), signal);
  const data = isRecord(stored) && isRecord(stored.data) && stored.data.tracking_number === number ? stored.data : null;
  if (data?.to_updated !== true || typeof data._id !== 'string') return stored;
  const scanned = Array.isArray(data.events) && data.events.length > 0;
  try {
    const fresh = await http.refresh(data._id, number, scanned ? Math.min(left(), REFRESH_MS) : left(), signal);
    return isRecord(fresh) && isRecord(fresh.data) && fresh.data.tracking_number === number ? fresh : stored;
  } catch (error) {
    if (signal?.aborted || !scanned) throw error;
    return stored;
  }
}

export interface Ship24Options extends Omit<UniversalBrowserOptions, 'signal'> {
  /** The signed HTTP client for the direct tier; without one the browser tier runs alone. */
  httpClient?: Ship24HttpClient | null;
  recorder?: StepRecorder;
}

export class Ship24Tracker {
  constructor(readonly options: Ship24Options = {}) {}

  async fetch(trackingNumber: string, budgetMs?: number, timezone: string | null = null, signal?: AbortSignal): Promise<CarrierResult> {
    const number = numberOf(trackingNumber);
    const timeoutMs = budgetMs ?? this.options.timeoutMs ?? 45_000;
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 60_000) throw new TypeError('Ship24 timeout must be between 1 and 60000 ms');
    const http = this.options.httpClient ?? null;
    const browser = http === null || Boolean(this.options.executablePath);
    return runSteps({ carrier: SOURCE, budgetMs: timeoutMs, signal, recorder: this.options.recorder }, [
      {
        id: 'direct',
        enabled: http !== null,
        run: async ({ remainingMs, signal }) => ({
          ...parseShip24Response(await currentParcel(http!, number, browser
            ? Math.max(remainingMs / 2, remainingMs - BROWSER_RESERVE_MS) : remainingMs, signal), number, timezone),
          tracking_source: 'structured-web-response',
        }),
      },
      {
        id: 'browser',
        // Without a Chromium this tier could only replace the direct failure
        // with its own configuration error. Alone, it still runs to report it.
        enabled: browser,
        recovers: browserCanRecover,
        run: async ({ remainingMs, signal }) => ({
          ...await scrapeUniversalPage({ executablePath: this.options.executablePath, timeoutMs: Math.max(1, Math.floor(remainingMs)), signal }, {
            name: SOURCE, url: `https://www.ship24.com/tracking?p=${number}`,
            responseUrl: `https://api.ship24.com/api/parcels/${number}?lang=en`,
          }, (payload) => parseShip24Response(payload, number, timezone)),
          tracking_source: 'browser-session-response',
        }),
      },
    ]);
  }
}

export const adapter: AdapterFactory = (environment) => {
  const tracker = new Ship24Tracker({
    httpClient: new Ship24HttpClient(environment.fetcher, environment.userAgent),
    executablePath: environment.browserExecutablePath ?? undefined,
    recorder: environment.recorder,
  });
  return {
    id: SOURCE,
    steps: ['direct', 'browser'],
    track: (input, context) => tracker.fetch(input.number, context?.budgetMs, input.timezone ?? null, context?.signal),
  };
};
