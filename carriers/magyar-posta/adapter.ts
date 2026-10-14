import type { AdapterFactory, TrackingContext } from '../../core/adapter/index.js';
import { BudgetExceededError, ChallengeError, RateLimitedError, SchemaError, TransportError, UpstreamHttpError } from '../../core/errors/index.js';
import type { CarrierResult } from '../../core/result/index.js';
import { runSteps } from '../../core/runner/index.js';
import { NOOP_RECORDER, type StepRecorder } from '../../core/telemetry/index.js';
import type { TrawlClient } from '../../core/transport/trawl.js';
import { MAGYAR_POSTA_MAX_BYTES, magyarPostaTrackingUrl, normalizeMagyarPostaNumber, parseMagyarPosta, PROVIDER } from './parser.js';

export { magyarPostaTrackingUrl, normalizeMagyarPostaNumber, parseMagyarPosta } from './parser.js';

/** The search form's endpoint, and the result page it redirects to. */
export const MAGYAR_POSTA_SEARCH = 'https://www.posta.hu/ikrnyomkovproxy/Search/Search';
export const MAGYAR_POSTA_RESULT = 'https://www.posta.hu/ikrnyomkovproxy/Result/Index';

/** A refused or failed page; a missing route is not a missing item. */
function httpFailure(status: number, retryAfter?: string): Error | null {
  if (status === 429) return new RateLimitedError(PROVIDER, retryAfter && /^\d{1,5}$/.test(retryAfter) ? Number(retryAfter) * 1000 : undefined);
  if (status === 401 || status === 403) return new ChallengeError(PROVIDER);
  if (status === 404 || status === 410) return new TransportError(PROVIDER, 'Magyar Posta tracker is unavailable');
  return status >= 400 ? new UpstreamHttpError(PROVIDER, status) : null;
}

/**
 * One search through the browser service: its helper solves the tracker's
 * reCAPTCHA checkbox, searches the number and returns the result page its
 * search redirected to, bound to the whole number.
 */
export async function magyarPostaBrowser(trawl: TrawlClient, raw: string, signal: AbortSignal, remainingMs: number): Promise<CarrierResult> {
  const number = normalizeMagyarPostaNumber(raw);
  const timeoutMs = Math.floor(remainingMs - 2000);
  if (timeoutMs < 1) throw new BudgetExceededError(PROVIDER, remainingMs);
  const page = await trawl.scrape({ url: magyarPostaTrackingUrl(number), skipHttp: true, maxTier: 3,
    captureResponses: [MAGYAR_POSTA_RESULT], maxTimeout: timeoutMs, settleTimeout: timeoutMs },
  { provider: PROVIDER, timeoutMs, signal, requireSolved: false, captureWindow: 'last', maxBytes: 6 * MAGYAR_POSTA_MAX_BYTES });
  signal.throwIfAborted();
  if (page.capturedResponses.length > 10) throw new ChallengeError(PROVIDER, 'Magyar Posta returned no matching verified search');
  const result = page.capturedResponses.filter(row => row.url === MAGYAR_POSTA_RESULT && row.trackingNumberSubmitted === number).at(-1);
  const search = page.capturedResponses.filter(row => row.url === MAGYAR_POSTA_SEARCH).at(-1);
  const response = result ?? search;
  if (!response) {
    // No search left the tracker: its own page failed, or the checkbox was not solved.
    throw httpFailure(page.statusCode) ?? new ChallengeError(PROVIDER, 'Magyar Posta returned no verified search');
  }
  const failure = httpFailure(response.status, response.headers['retry-after']);
  if (failure) throw failure;
  if (!result) {
    // The search form back without a redirect is a refused verification.
    if (response.status === 200) throw new ChallengeError(PROVIDER, 'Magyar Posta refused the reCAPTCHA answer');
    throw new TransportError(PROVIDER, 'Magyar Posta did not return the search result');
  }
  if (result.status !== 200 || result.error || result.truncated || result.base64Encoded || !result.body) {
    throw new TransportError(PROVIDER, 'Magyar Posta returned an incomplete browser response');
  }
  if (Buffer.byteLength(result.body) > MAGYAR_POSTA_MAX_BYTES) throw new SchemaError(PROVIDER, 'Magyar Posta returned excessive browser data');
  return parseMagyarPosta(result.body, number);
}

export class MagyarPostaTracker {
  constructor(private readonly options: { trawl?: TrawlClient | null; recorder?: StepRecorder } = {}) {}

  async fetch(raw: string, context: TrackingContext = {}): Promise<CarrierResult> {
    const number = normalizeMagyarPostaNumber(raw);
    const trawl = this.options.trawl;
    // Every search needs a solved checkbox, which only the browser service provides.
    if (!trawl) throw new ChallengeError(PROVIDER, 'Magyar Posta requires the browser tracking service');
    return runSteps({ carrier: 'magyar-posta', budgetMs: context.budgetMs ?? 45_000, signal: context.signal,
      recorder: this.options.recorder ?? NOOP_RECORDER }, [
      { id: 'trawl', run: ({ signal, remainingMs }) => magyarPostaBrowser(trawl, number, signal, remainingMs) },
    ]);
  }
}

export const adapter: AdapterFactory = (environment) => {
  const tracker = new MagyarPostaTracker({ trawl: environment.trawl, recorder: environment.recorder });
  return { id: 'magyar-posta', recordsSteps: true, steps: ['trawl'], track: (input, context) => tracker.fetch(input.number, context) };
};
