
import { load } from 'cheerio';
import { recognizeFromBrowserLookup, type AdapterFactory, type TrackingContext } from '../../core/adapter/index.js';
import { fillPartialAnswer } from '../../core/result/partial.js';
import { fedexBarcodeTrackingNumber, fedexGroundEconomyUspsNumber } from '../../core/detection/fedex.js';
import { uspsPackageIdentifier } from '../../core/detection/usps.js';
import {
  ChallengeError,
  InputRequiredError,
  InvalidInputError,
  RateLimitedError,
  SchemaError,
  TransportError,
  UpstreamHttpError,
} from '../../core/errors/index.js';
import type { CarrierEvent, CarrierResult } from '../../core/result/index.js';
import { runSteps } from '../../core/runner/index.js';
import { NOOP_RECORDER, type StepRecorder } from '../../core/telemetry/index.js';
import { calendarDay, explicitOffsetTime } from '../../core/time/index.js';
import { clean, cleanScalar, TRAWL_TRANSPORT_ALLOWANCE_MS, type TrawlClient } from '../../core/transport/index.js';
import { isRecord, type JsonObject } from '../../core/types.js';
import { FEDEX_CODE_STAGE, fedexStage, fedexStatus, statusForStage } from './status.js';

/**
 * FedEx, through the tracking reply the public page reads itself.
 *
 * The page at `fedextrack/?trknbr=` is a shell: every byte of tracking data
 * arrives as `POST https://api.fedex.com/track/v2/shipments`, a
 * browser-gated call. Plain HTTP and the deployed browser service received
 * HTTP 403 on 2026-09-22, while an interactive browser returned full history.
 * The browser service retains verified FedEx contexts for later lookups.
 * API rejection must stay a challenge so routing applies cooldown/fallback.
 * The browser's session is never replayed over plain HTTP.
 *
 * Response shape provenance: the page bundle's package model (`trackingNbr`,
 * `keyStatus`/`keyStatusCD`, `scanEventList` items with
 * `date`/`time`/`gmtOffset`/`scanLocation`/`status`/`statusCD`/`scanDetails`,
 * and the hold location's `halCmpnyName`/`halAddress`), inspected 2026-09-20
 * and 2026-10-08.
 */
const TRACKING_BASE = 'https://www.fedex.com/fedextrack/';
const TRACK_API = 'https://api.fedex.com/track/v2/shipments';
const MAX_BYTES = 10_000_000;
const DEFAULT_TIMEOUT_MS = 90_000;
// How long the browser may wait for the page's own tracking call after the page settles.
const SETTLE_TIMEOUT_MS = 15_000;
// Captured replies beyond this many are noise, never the answer.
const MAX_CAPTURED = 20;
const MAX_EVENTS_TO_INSPECT = 500;
const MAX_EVENTS_TO_RETURN = 100;
const HOUR_MS = 3_600_000;

export function normalizeFedExTrackingNumber(raw: string): string {
  const value = raw.toLocaleUpperCase('en-US').replace(/[\s.-]/g, '');
  // A scanned label barcode is tracked by the tracking number it carries.
  const embedded = fedexBarcodeTrackingNumber(value);
  if (embedded) return embedded;
  // Twelve or fifteen digits, or a twenty-digit Ground Economy number. Its check
  // digit is not enforced here: detection already ranks by it, and a number a
  // caller insists on still reaches FedEx.
  if (!/^(?:\d{12}|\d{15}|\d{20})$/.test(value)) {
    throw new InvalidInputError('FedEx', 'FedEx tracking numbers must contain 12, 15 or 20 digits, or be a checksum-valid 22- or 34-digit FedEx label barcode');
  }
  return value;
}

export function fedexTrackingUrl(trackingNumber: string): string {
  const url = new URL(TRACKING_BASE);
  url.searchParams.set('trknbr', normalizeFedExTrackingNumber(trackingNumber));
  return url.toString();
}

/**
 * A scan's clock. FedEx sends a local wall-clock pair plus its explicit
 * offset, assembled into an offset-carrying ISO string rather than parsed, so
 * no zone is ever guessed. A step FedEx dates by its day alone, as it does its
 * pickup, comes with a 00:00:00 time and no offset; it keeps the day in
 * `local_time` rather than a midnight. Any other unusable triple keeps no clock.
 */
function scanClock(scan: JsonObject): Pick<CarrierEvent, 'time'> & { local_time?: string } {
  const date = cleanScalar(scan.date);
  const time = cleanScalar(scan.time);
  const offset = cleanScalar(scan.gmtOffset);
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!day) return {};
  if (/^\d{2}:\d{2}(?::\d{2})?$/.test(time) && /^[+-]\d{2}:?\d{2}$/.test(offset)) {
    const clock = time.length === 5 ? `${time}:00` : time;
    const parsed = explicitOffsetTime(`${date}T${clock}${offset}`);
    return parsed ? { time: parsed.iso } : {};
  }
  const local = !offset && /^00:00(?::00)?$/.test(time)
    ? calendarDay(Number(day[1]), Number(day[2]), Number(day[3])) : null;
  return local ? { local_time: local } : {};
}

interface ListedScan {
  event: CarrierEvent;
  /** Its place in FedEx's list, which runs newest first. */
  index: number;
  /** The day of a scan dated by its day alone, else empty. */
  day: string;
}

/**
 * Newest first. A scan with a time sorts by its instant, since each carries
 * its own offset, and one without a clock comes last. A scan dated by its day
 * alone could be any time from the day's start at UTC+14 to its end at UTC−12:
 * it goes below every scan certainly later, above every scan certainly earlier,
 * and in FedEx's own order among the rest.
 */
function newestFirst(scans: readonly ListedScan[]): CarrierEvent[] {
  const instant = (scan: ListedScan) => Date.parse(scan.event.time ?? '') || 0;
  const ordered = scans.filter((scan) => !scan.day).sort((left, right) => instant(right) - instant(left));
  for (const scan of scans.filter((scan) => scan.day)) {
    const start = Date.parse(`${scan.day}T00:00:00Z`);
    const at = ordered.findIndex((other) => other.day ? other.index > scan.index
      : instant(other) < start - 14 * HOUR_MS || (instant(other) < start + 36 * HOUR_MS && other.index > scan.index));
    ordered.splice(at < 0 ? ordered.length : at, 0, scan);
  }
  return ordered.map((scan) => scan.event);
}

function scanDescription(scan: JsonObject): string {
  const status = clean(scan.status);
  const details = clean(scan.scanDetails);
  if (details && !status.toLocaleLowerCase('en-US').includes(details.toLocaleLowerCase('en-US'))) {
    return clean(`${status} — ${details}`);
  }
  return status;
}

/** Delivery-date estimate as a calendar day; anything else is not an estimate. */
function expectedDelivery(value: unknown): string | null {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(cleanScalar(value, 64));
  return match ? match[1]! : null;
}

/** A delivered-at instant; offset-less or unparsable values are dropped. */
function deliveredAt(value: unknown): string | null {
  return explicitOffsetTime(value)?.iso ?? null;
}

/**
 * The hold location, read only while the parcel waits there: its name, then
 * its street and its town on their own lines when FedEx gives both. These are
 * the `halCmpnyName` and `halAddress` the page reads for a held parcel. The
 * recipient and shipper blocks are never a fallback, and a residential hold
 * address is someone's home, so it is never projected.
 */
function holdLocation(shipment: JsonObject): string {
  const name = clean(shipment.halCmpnyName, 200);
  const address: JsonObject = isRecord(shipment.halAddress) ? shipment.halAddress : {};
  if (!name || shipment.halresidential === true || address.residential === true) return '';
  const street = Array.isArray(address.streetLines)
    ? address.streetLines.map((line) => clean(line, 120)).filter(Boolean)
    : [];
  const city = clean(address.city, 80);
  if (street.length === 0 || !city) return name;
  const postcode = cleanScalar(address.postalCode, 16);
  // A US state or Canadian province comes before the postcode, after the town.
  const region = clean(address.stateOrProvinceCode, 40);
  const town = region ? `${city}, ${[region, postcode].filter(Boolean).join(' ')}` : [postcode, city].filter(Boolean).join(' ');
  return [name, street[0], street.slice(1).join(', '), town].filter(Boolean).join('\n');
}

// FedEx flags a parcel scanned in after the day's cutoff as delayed (`DY`) while
// its wording reads as an ordinary pickup: the parcel leaves on the next business
// day. Only that newest pickup scan explains the flag.
const AFTER_CUTOFF = /\breceived after fedex cutoff\b/i;

// Ground Economy can hand a parcel to the U.S. Postal Service for the last leg.
// FedEx then relays USPS's scans, the first naming the package number USPS
// tracks it under; most parcels instead say delivery stays with FedEx Ground.
const USPS_HAS_PARCEL = /\b(?:accepted by|at|with|delivered by) (?:the )?u\.?s\.? postal service\b/i;
// A negation before USPS in the same sentence says USPS does not have it.
const USPS_NEGATED = /\b(?:not|never|no longer)\b[^.;!?]*\bu\.?s\.? postal service\b/i;
const USPS_TRACKING_ID = /\btracking id\s*:?\s*(\d{22}|\d{26})\b/i;

/**
 * The USPS package number a parcel travels under once a scan shows USPS has
 * it: the one the scan names, else, for a 20-digit Ground Economy number whose
 * check digit passes, that number with 92 in front. Otherwise null.
 */
function uspsHandoff(scans: readonly JsonObject[], number: string): string | null {
  const texts = scans.map((scan) => `${clean(scan.status)} ${clean(scan.scanDetails)}`)
    .filter((text) => USPS_HAS_PARCEL.test(text) && !USPS_NEGATED.test(text));
  if (texts.length === 0) return null;
  for (const text of texts) {
    const named = uspsPackageIdentifier(USPS_TRACKING_ID.exec(text)?.[1] ?? '');
    if (named) return named;
  }
  return fedexGroundEconomyUspsNumber(number);
}

function errorCode(error: unknown): string {
  return isRecord(error) ? cleanScalar(error.code).toLocaleUpperCase('en-US') : '';
}

/** An empty answer proves nothing either way, so it stays a retryable unknown. */
function notLocated(): CarrierResult {
  return {
    status: 'unknown',
    last_status_text: 'FedEx could not locate the shipment',
    last_update: null,
    expected_delivery: null,
    events: [],
  };
}

/** The structured answer of the tracking page's own API call. */
export function parseFedExTrackingResponse(payload: unknown, trackingNumber: string): CarrierResult {
  const number = normalizeFedExTrackingNumber(trackingNumber);
  if (!isRecord(payload) || !isRecord(payload.output)) {
    throw new SchemaError('FedEx', 'FedEx returned an invalid tracking response');
  }
  const output = payload.output;
  const packages = Array.isArray(output.packages) ? output.packages.filter(isRecord) : null;
  if (!packages) throw new SchemaError('FedEx', 'FedEx returned an invalid tracking response');
  if (packages.length === 0) {
    const codes = Array.isArray(output.errorList) ? output.errorList.map(errorCode).join(' ') : '';
    if (/AUTHENTICAT|AUTHORIZATION/.test(codes)) {
      throw new InputRequiredError('FedEx', 'recipient verification',
        'FedEx requires recipient verification for this shipment');
    }
    return notLocated();
  }
  const matches = packages.filter((item) =>
    cleanScalar(item.trackingNbr).replace(/[\s.-]/g, '').toLocaleUpperCase('en-US') === number);
  if (matches.length !== 1) {
    throw new SchemaError('FedEx', matches.length === 0
      ? 'FedEx did not return the requested parcel'
      : 'FedEx returned several shipments for this number');
  }
  const shipment = matches[0]!;
  const scans = Array.isArray(shipment.scanEventList) ? shipment.scanEventList.filter(isRecord) : [];
  const errors = Array.isArray(shipment.errorList) ? shipment.errorList.filter(isRecord) : [];
  const codes = errors.map(errorCode).join(' ');
  // Error replies can echo the number with a default status and an empty scan.
  // Those placeholders cannot establish a shipment, even when the status says moving.
  if (/TRACKINGNUMBER|NOTFOUND|NOT FOUND|NO TRACKING/.test(codes)) return notLocated();
  const keyStatus = clean(shipment.keyStatus);
  const keyStatusCD = cleanScalar(shipment.keyStatusCD);
  const statusDetails = clean(shipment.statusWithDetails);
  if (scans.length === 0 && !keyStatus && !keyStatusCD) {
    if (/AUTHENTICAT|AUTHORIZATION/.test(codes)) {
      throw new InputRequiredError('FedEx', 'recipient verification',
        'FedEx requires recipient verification for this shipment');
    }
    throw new SchemaError('FedEx', 'FedEx returned no usable tracking status');
  }
  const listed: ListedScan[] = [];
  const seen = new Set<string>();
  for (const [index, raw] of scans.slice(0, MAX_EVENTS_TO_INSPECT).entries()) {
    const description = scanDescription(raw);
    if (!description) continue;
    const statusCD = cleanScalar(raw.statusCD).toLocaleUpperCase('en-US');
    const stage = FEDEX_CODE_STAGE[statusCD]
      ?? fedexStage(`${clean(raw.status)} ${clean(raw.scanDetails)}`)
      ?? undefined;
    const clock = scanClock(raw);
    const location = clean(raw.scanLocation);
    // A delivered scan names its signatory; the event keeps the fact, not the name.
    const event: CarrierEvent = {
      ...clock,
      ...(location ? { location } : {}),
      description: stage === 'delivered' ? 'Delivered' : description,
      ...(stage ? { stage } : {}),
    };
    const identity = JSON.stringify([clock.time ?? clock.local_time ?? '', event.location ?? '', event.description]);
    if (seen.has(identity)) continue;
    seen.add(identity);
    listed.push({ event, index, day: clock.local_time ?? '' });
  }
  const trimmed = newestFirst(listed).slice(0, MAX_EVENTS_TO_RETURN);
  const newest = trimmed[0];
  const statusText = keyStatus || newest?.description || 'Tracking information received';
  const wording = fedexStage(`${keyStatus} ${statusDetails}`);
  const afterCutoff = keyStatusCD.toUpperCase() === 'DY' && newest?.stage === 'accepted'
    && AFTER_CUTOFF.test(newest.description ?? '') && !(wording && statusForStage(wording) === 'exception');
  const stage = afterCutoff ? 'accepted' : FEDEX_CODE_STAGE[keyStatusCD.toUpperCase()] ?? wording ?? undefined;
  const status = afterCutoff ? 'in_transit' : fedexStatus(keyStatusCD, `${keyStatus} ${statusDetails}`, trimmed.length > 0);
  const delivered = stage === 'delivered';
  const estimate = delivered ? null : expectedDelivery(shipment.estDeliveryDt);
  const pickupPoint = stage === 'ready_for_pickup' ? holdLocation(shipment) : '';
  const postal = uspsHandoff(scans.slice(0, MAX_EVENTS_TO_INSPECT), number);
  return {
    status,
    ...(stage ? { current_stage: stage } : {}),
    last_status_text: delivered ? 'Delivered' : statusText,
    last_update: newest?.time || null,
    // A newest scan dated by its day alone has no instant, only that day.
    ...(!newest?.time && typeof newest?.local_time === 'string' ? { last_update_local: newest.local_time } : {}),
    expected_delivery: estimate,
    ...(delivered && deliveredAt(shipment.actDeliveryDt)
      ? { delivered_at: deliveredAt(shipment.actDeliveryDt) } : {}),
    ...(pickupPoint ? { pickup_point: pickupPoint } : {}),
    ...(postal ? { delivery_carrier: 'usps', delivery_tracking_number: postal } : {}),
    ...(trimmed.length === 0 ? { summary_only: true } : {}),
    events: trimmed,
  };
}

/**
 * The page the browser rendered, read only to tell a bot challenge from an
 * inconclusive load. The page renders its "can't find that tracking number"
 * notice both for unknown numbers and for tracking calls the edge refused,
 * so rendered text never decides not-found: only the structured reply does.
 */
export function parseFedExTrackingHtml(page: string): 'challenged' | 'inconclusive' {
  const $ = load(page);
  $('script, style, noscript').remove();
  const visible = clean($('body').text(), 20_000);
  if (/access denied|system down|just a moment|attention required|are you a robot|verify you are human|before you proceed/i.test(visible)) {
    return 'challenged';
  }
  return 'inconclusive';
}

export interface FedExTrackerOptions {
  timeoutMs?: number;
  /** The browser service, or null when none is configured. */
  trawl?: TrawlClient | null;
  fetcher?: typeof fetch;
  recorder?: StepRecorder;
}

export class FedExTracker {
  readonly timeoutMs: number;
  readonly #trawl: TrawlClient | null;
  readonly #fetcher: typeof fetch | undefined;
  readonly #recorder: StepRecorder;

  constructor(options: FedExTrackerOptions = {}) {
    if (options.timeoutMs !== undefined && (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0)) {
      throw new TypeError('FedEx timeout must be positive');
    }
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.#trawl = options.trawl ?? null;
    this.#fetcher = options.fetcher;
    this.#recorder = options.recorder ?? NOOP_RECORDER;
  }

  async fetch(trackingNumber: string, context: TrackingContext = {}): Promise<CarrierResult> {
    const number = normalizeFedExTrackingNumber(trackingNumber);
    // Plain HTTP probes were rejected; the dedicated route uses the browser.
    const trawl = this.#trawl;
    if (!trawl) {
      throw new ChallengeError(
        'FedEx',
        'FedEx challenged direct tracking; configure FLARESOLVERR_URL for browser fallback',
      );
    }
    return runSteps<CarrierResult>({
      // Without a caller's budget the lookup leaves the service its own time and
      // the request the allowance to bring the answer back.
      carrier: 'fedex', budgetMs: context.budgetMs ?? this.timeoutMs + TRAWL_TRANSPORT_ALLOWANCE_MS, signal: context.signal,
      recorder: this.#recorder,
    }, [
      { id: 'trawl', run: ({ remainingMs, signal }) => this.#trawlResult(trawl, number, Math.max(1, Math.floor(Math.min(this.timeoutMs, remainingMs))), signal) },
      // The service discards a context whose tracking call was refused, so a
      // second read starts a fresh one: Akamai's 403 is intermittent.
      { id: 'trawl', recovers: (error) => error instanceof ChallengeError && error.reason === 'api_denied' && error.status === 403,
        run: ({ remainingMs, signal }) => this.#trawlResult(trawl, number, Math.max(1, Math.floor(Math.min(this.timeoutMs, remainingMs))), signal) },
    ]);
  }

  /**
   * A real browser loads the page and makes the tracking call itself; the
   * service hands that reply back. The browser's session is never replayed
   * over plain HTTP: the edge accepts the call only from the session it
   * validated. The page the browser rendered only tells a challenge apart.
   */
  async #trawlResult(trawl: TrawlClient, number: string, timeoutMs: number, signal: AbortSignal): Promise<CarrierResult> {
    const page = await trawl.scrape({
      url: fedexTrackingUrl(number),
      skipHttp: true,
      maxTier: 3,
      maxTimeout: timeoutMs,
      captureResponses: [TRACK_API],
      settleTimeout: SETTLE_TIMEOUT_MS,
    }, {
      provider: 'TRAWL while fetching FedEx',
      timeoutMs,
      maxBytes: MAX_BYTES,
      fetcher: this.#fetcher,
      signal,
    });
    let captureError: Error | undefined;
    // Newest first: a later reply is the page's final answer.
    const responses = page.capturedResponses.slice(-MAX_CAPTURED).reverse();
    for (const [index, entry] of responses.entries()) {
      if (entry.url !== TRACK_API) continue;
      if (entry.status === 0 && entry.error === 'fedex-tracking-request-failed') {
        throw new TransportError('FedEx', 'FedEx tracking request did not complete');
      }
      // The page shell can load normally while its tracking API is rejected.
      // Preserve that failure instead of reporting a missing capture or falling
      // back to an older successful reply from the same page.
      if (entry.status === 401 || entry.status === 403) {
        throw new ChallengeError('FedEx', 'FedEx rejected the browser tracking request', { status: entry.status, reason: 'api_denied' });
      }
      if (entry.status === 429) {
        const header = entry.headers['retry-after'] ?? entry.headers['Retry-After'];
        const delay = header && /^\d+(?:\.\d+)?$/.test(header) ? Number(header) * 1000
          : header ? Date.parse(header) - Date.now() : NaN;
        throw new RateLimitedError('FedEx', Number.isFinite(delay) ? Math.max(0, delay) : undefined);
      }
      if (entry.status >= 500) throw new UpstreamHttpError('FedEx', entry.status);
      if (entry.status >= 400) {
        throw new TransportError('FedEx', `FedEx tracking API returned HTTP ${entry.status}`, { status: entry.status });
      }
      if (entry.status !== 200) continue;
      if (entry.truncated || entry.body === null) {
        captureError = new SchemaError('FedEx', 'FedEx tracking response could not be read completely');
        break;
      }
      try {
        const payload: unknown = JSON.parse(entry.body);
        const result = this.#structuredResult(number, payload);
        // A later status can omit scans that this same lookup already received.
        // It keeps that history only when it still fits the newer status and clock.
        if (result.summary_only === true) {
          const qualifier = (data: unknown): unknown => isRecord(data) && isRecord(data.output) && Array.isArray(data.output.packages)
            ? data.output.packages.filter(isRecord).find(item => cleanScalar(item.trackingNbr).replace(/[\s.-]/g, '') === number)?.trackingQualifier
            : undefined;
          for (const earlier of responses.slice(index + 1)) {
            if (earlier.url !== TRACK_API || earlier.status !== 200 || earlier.truncated || earlier.body === null) continue;
            try {
              const prior: unknown = JSON.parse(earlier.body);
              if (qualifier(prior) !== qualifier(payload)) continue;
              const filled = fillPartialAnswer('fedex', number, result, this.#structuredResult(number, prior));
              if (filled) return filled;
            } catch { /* An earlier unreadable reply supplies no history. */ }
          }
        }
        return result;
      } catch (error) {
        if (error instanceof InputRequiredError) throw error;
        // An unreadable or unrelated reply; the rendered page may still name a challenge.
        captureError ??= error instanceof SyntaxError
          ? new SchemaError('FedEx', 'FedEx returned unreadable tracking JSON', { cause: error })
          : error instanceof Error ? error : new SchemaError('FedEx', 'FedEx returned invalid tracking data', { cause: error });
        break;
      }
    }
    if (parseFedExTrackingHtml(page.html) === 'challenged') {
      throw new ChallengeError('FedEx', 'FedEx challenged the browser tracking session', { cause: captureError });
    }
    if (captureError) throw captureError;
    throw new TransportError('FedEx', 'TRAWL did not capture the FedEx tracking response', { cause: captureError });
  }

  #structuredResult(number: string, payload: unknown): CarrierResult {
    const result = parseFedExTrackingResponse(payload, number);
    result.tracking_url = fedexTrackingUrl(number);
    result.tracking_source = 'structured-web-response';
    return result;
  }
}

export const adapter: AdapterFactory = (environment) => {
  const tracker = new FedExTracker({
    fetcher: environment.fetcher,
    trawl: environment.trawl,
    recorder: environment.recorder,
  });
  return {
    id: 'fedex', recordsSteps: true,
    // Browser-backed direct tracking; universal recovery belongs to the caller.
    steps: ['trawl'],
    track: (input, context) => tracker.fetch(input.number, context),
    recognizeWithBrowser: (number, context) => recognizeFromBrowserLookup(() => tracker.fetch(number, context)),
  };
};
