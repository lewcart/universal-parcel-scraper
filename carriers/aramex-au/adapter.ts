import { accepted, recognizeFromLookup, type AdapterFactory, type TrackingContext } from '../../core/adapter/index.js';
import { ChallengeError, RateLimitedError, SchemaError, TransportError } from '../../core/errors/index.js';
import type { CarrierResult } from '../../core/result/index.js';
import { runSteps } from '../../core/runner/index.js';
import { firstAttemptMs, networkRetryStep } from '../../core/runner/networkRetry.js';
import { NOOP_RECORDER, type StepRecorder } from '../../core/telemetry/index.js';
import { decodeText, fetchBounded, userAgentOf } from '../../core/transport/index.js';
import { ARAMEX_AU_MAX_BYTES, normalizeAramexAuNumber, parseAramexAu, PROVIDER } from './parser.js';

export const ARAMEX_AU_ORIGIN = 'https://www.aramex.com.au';
// The service the tracking page at aramex.com.au/tools/track asks, without an
// account, key, cookie or CAPTCHA token.
export const ARAMEX_AU_ENDPOINT = `${ARAMEX_AU_ORIGIN}/umbraco/api/TrackingApi/GetTrackingData`;
// A missing route is not a missing parcel: an unknown number is the service's own error.
const GONE = [404, 410];
// A CDN's or firewall's block page instead of the service's JSON.
const CHALLENGE = /<title>\s*(?:Just a moment|Attention Required|Access denied|403 Forbidden)|cf-turnstile|_cf_chl_opt|captcha|The requested URL was rejected/i;

function retryAfterMs(response: Response): number | undefined {
  const header = response.headers.get('retry-after')?.trim();
  return header && /^\d{1,6}$/.test(header) ? Number(header) * 1000 : undefined;
}

/** The address the tracking page asks for one number. */
export function aramexAuUrl(raw: string): string {
  const url = new URL(ARAMEX_AU_ENDPOINT);
  url.searchParams.set('LabelNo', normalizeAramexAuNumber(raw));
  url.searchParams.set('dataFormat', 'json');
  return url.toString();
}

export class AramexAuTracker {
  constructor(private readonly options: { fetcher?: typeof fetch; recorder?: StepRecorder; userAgent?: string } = {}) {}

  async fetch(raw: string, context: TrackingContext = {}): Promise<CarrierResult> {
    const url = aramexAuUrl(raw);
    const read = async (signal: AbortSignal, timeoutMs: number): Promise<CarrierResult> => {
      const { response, bytes } = await fetchBounded(url, { method: 'GET', signal, headers: {
        // The service answers JSON under a JavaScript content type.
        Accept: 'application/json, text/javascript, */*;q=0.1', 'Accept-Language': 'en-AU,en;q=0.8',
        Referer: `${ARAMEX_AU_ORIGIN}/tools/track/`, 'User-Agent': userAgentOf(this.options.userAgent),
      } }, { provider: PROVIDER, timeoutMs: Math.max(1, Math.floor(timeoutMs)), maxBytes: ARAMEX_AU_MAX_BYTES,
        fetcher: this.options.fetcher, allowHttpStatuses: [...GONE, 429] });
      const text = decodeText(bytes);
      if (response.status === 429) throw new RateLimitedError(PROVIDER, retryAfterMs(response));
      if (GONE.includes(response.status)) throw new TransportError(PROVIDER, 'Aramex Australia tracking service is unavailable');
      let payload: unknown;
      try {
        payload = JSON.parse(text);
      } catch (cause) {
        if (CHALLENGE.test(text.slice(0, 64_000))) throw new ChallengeError(PROVIDER, 'Aramex Australia answered with a block page', { cause });
        throw new SchemaError(PROVIDER, 'Aramex Australia returned a reply that is not JSON', { cause });
      }
      return parseAramexAu(payload, raw);
    };
    // A request that fails to reach Aramex, or hangs, gets one more try: the
    // first gets half of the budget, so the retry fits in the rest.
    return runSteps({ carrier: 'aramex-au', budgetMs: context.budgetMs ?? 15_000, signal: context.signal,
      recorder: this.options.recorder ?? NOOP_RECORDER }, [
      { id: 'direct', run: ({ signal, remainingMs }) => read(signal, firstAttemptMs(remainingMs)) },
      networkRetryStep(({ signal, remainingMs }) => read(signal, remainingMs)),
    ]);
  }
}

export const adapter: AdapterFactory = (environment) => {
  const tracker = new AramexAuTracker({ fetcher: environment.fetcher, recorder: environment.recorder, userAgent: environment.userAgent });
  return {
    id: 'aramex-au', recordsSteps: true, steps: ['direct', 'retry'],
    track: (input, context) => tracker.fetch(input.number, context),
    recognize: (number, context) => recognizeFromLookup(() => tracker.fetch(number, context),
      () => accepted(() => normalizeAramexAuNumber(number))),
  };
};
