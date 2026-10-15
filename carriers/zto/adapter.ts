import { accepted, recognizeFromBrowserLookup, recognizeFromLookup, type AdapterEnvironment, type AdapterFactory, type TrackingContext } from '../../core/adapter/index.js';
import { BudgetExceededError, ChallengeError, RateLimitedError, SchemaError, TransportError, UpstreamHttpError } from '../../core/errors/index.js';
import type { CarrierResult } from '../../core/result/index.js';
import { runSteps } from '../../core/runner/index.js';
import { decodeText, fetchBounded, userAgentOf } from '../../core/transport/index.js';
import { API, MAX_BYTES, normalizeZtoNumber, PAGE, parseZto, PROVIDER } from './parser.js';

export class ZtoTracker {
  constructor(private readonly environment: AdapterEnvironment) {}

  async direct(raw: string, context: TrackingContext = {}): Promise<CarrierResult> {
    const number = normalizeZtoNumber(raw);
    const { bytes } = await fetchBounded(API, { method: 'POST', body: JSON.stringify({ items: [{ billCode: number }] }), signal: context.signal,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': userAgentOf(this.environment.userAgent) } },
    { provider: PROVIDER, timeoutMs: Math.max(1, Math.floor(context.budgetMs ?? 5000)), maxBytes: MAX_BYTES, fetcher: this.environment.fetcher });
    return this.parse(decodeText(bytes), number);
  }

  private parse(body: string, number: string): CarrierResult {
    if (/^\s*</.test(body)) throw new ChallengeError(PROVIDER, 'ZTO returned a browser challenge');
    let payload: unknown;
    try { payload = JSON.parse(body); } catch { throw new SchemaError(PROVIDER, 'ZTO returned invalid JSON'); }
    return parseZto(payload, number);
  }

  async browser(raw: string, signal: AbortSignal, remainingMs: number): Promise<CarrierResult> {
    const number = normalizeZtoNumber(raw);
    if (!this.environment.trawl) throw new ChallengeError(PROVIDER, 'ZTO requires the browser tracking service');
    const timeoutMs = Math.floor(remainingMs - 2000);
    if (timeoutMs < 1) throw new BudgetExceededError(PROVIDER, remainingMs);
    const page = await this.environment.trawl.scrape({ url: `${PAGE}?waybills=${number}`, skipHttp: true, maxTier: 3,
      maxTimeout: timeoutMs, captureResponses: [API], settleTimeout: timeoutMs },
    { provider: PROVIDER, timeoutMs, signal, maxBytes: 6 * MAX_BYTES, requireSolved: false, captureWindow: 'last' });
    signal.throwIfAborted();
    const matching = page.capturedResponses.filter(row => {
      try { const url = new URL(row.url); return url.origin + url.pathname === API && !url.username && !url.password
        && !url.search && !url.hash && row.trackingNumberSubmitted === number; } catch { return false; }
    });
    const response = matching.at(-1);
    if (!response || matching.length > 10) throw new ChallengeError(PROVIDER, 'ZTO returned no matching tracking response');
    if (response.status === 429) throw new RateLimitedError(PROVIDER);
    if ([401, 403, 428].includes(response.status)) throw new ChallengeError(PROVIDER);
    if (response.status >= 400) throw new UpstreamHttpError(PROVIDER, response.status);
    if (response.error || response.truncated || response.base64Encoded || response.body === null) throw new TransportError(PROVIDER, 'ZTO returned an incomplete browser response');
    if (response.status !== 200 || Buffer.byteLength(response.body) > MAX_BYTES) throw new SchemaError(PROVIDER, 'ZTO returned invalid browser data');
    return this.parse(response.body, number);
  }

  fetch(raw: string, context: TrackingContext = {}): Promise<CarrierResult> {
    const number = normalizeZtoNumber(raw);
    return runSteps({ carrier: 'zto', budgetMs: context.budgetMs ?? 45000, signal: context.signal, recorder: this.environment.recorder }, [
      { id: 'direct', run: ({ signal, remainingMs }) => this.direct(number, { signal, budgetMs: Math.min(5000, remainingMs) }) },
      { id: 'trawl', enabled: !!this.environment.trawl, run: ({ signal, remainingMs }) => this.browser(number, signal, remainingMs) },
    ]);
  }
}

export const adapter: AdapterFactory = environment => {
  const tracker = new ZtoTracker(environment);
  return { id: 'zto', recordsSteps: true, steps: ['direct', 'trawl'], track: (input, context) => tracker.fetch(input.number, context),
    recognize: (number, context) => recognizeFromLookup(() => tracker.direct(number, context), () => accepted(() => normalizeZtoNumber(number))),
    recognizeWithBrowser: (number, context, previous) => {
      if (previous instanceof SchemaError || previous instanceof RateLimitedError) return Promise.reject(previous);
      return recognizeFromBrowserLookup(() => runSteps({ carrier: 'zto', budgetMs: context?.budgetMs ?? 45000,
        signal: context?.signal, recorder: environment.recorder }, [
        { id: 'trawl', run: ({ signal, remainingMs }) => tracker.browser(number, signal, remainingMs) },
      ]));
    } };
};
