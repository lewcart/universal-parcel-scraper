import { accepted, recognizeFromLookup, type AdapterFactory, type TrackingContext } from '../../core/adapter/index.js';
import { ChallengeError, IndeterminateError, SchemaError } from '../../core/errors/index.js';
import type { CarrierResult } from '../../core/result/index.js';
import { runSteps } from '../../core/runner/index.js';
import { firstAttemptMs, networkRetryStep } from '../../core/runner/networkRetry.js';
import { NOOP_RECORDER, type StepRecorder } from '../../core/telemetry/index.js';
import { decodeText, fetchBounded, userAgentOf } from '../../core/transport/index.js';
import { normalizeStallionNumber, parseStallion, PROVIDER, STALLION_MAX_BYTES } from './parser.js';

/** The WordPress action the tracking page posts its number to. */
export const STALLION_ENDPOINT = 'https://stallion.ca/wp-admin/admin-ajax.php';
const ACTION = 'se_track_form_submission';
// Cloudflare's challenge page, which can come instead of the reply.
const CHALLENGE = /_cf_chl_opt|cf-turnstile|<title>\s*(?:Just a moment|Attention Required)/i;

export class StallionTracker {
  constructor(private readonly options: { fetcher?: typeof fetch; recorder?: StepRecorder; userAgent?: string } = {}) {}

  async fetch(raw: string, context: TrackingContext = {}): Promise<CarrierResult> {
    const { number } = normalizeStallionNumber(raw);
    const read = async (signal: AbortSignal, timeoutMs: number): Promise<CarrierResult> => {
      const { bytes } = await fetchBounded(STALLION_ENDPOINT, { method: 'POST', signal, headers: {
        Accept: 'application/json, text/plain, */*', 'User-Agent': userAgentOf(this.options.userAgent),
      }, body: new URLSearchParams({ tracking_number: number, action: ACTION }) },
      { provider: PROVIDER, timeoutMs: Math.max(1, Math.floor(timeoutMs)), maxBytes: STALLION_MAX_BYTES, fetcher: this.options.fetcher });
      // The page answers JSON as HTML; WordPress answers "0" for an action it no longer has.
      const text = decodeText(bytes);
      let reply: unknown;
      try {
        reply = JSON.parse(text);
      } catch (cause) {
        if (CHALLENGE.test(text)) throw new ChallengeError(PROVIDER, 'Stallion Express answered with a browser challenge', { cause });
        throw new SchemaError(PROVIDER, 'Stallion Express returned a reply that is not JSON', { cause });
      }
      if (typeof reply === 'number') throw new IndeterminateError(PROVIDER, 'Stallion Express tracking action is unavailable');
      return parseStallion(reply, raw);
    };
    // A request that fails to reach the site, or hangs, gets one more try: the
    // first gets half of the budget, so the retry fits in the rest.
    return runSteps({ carrier: 'stallion-express', budgetMs: context.budgetMs ?? 15_000, signal: context.signal,
      recorder: this.options.recorder ?? NOOP_RECORDER }, [
      { id: 'direct', run: ({ signal, remainingMs }) => read(signal, firstAttemptMs(remainingMs)) },
      networkRetryStep(({ signal, remainingMs }) => read(signal, remainingMs)),
    ]);
  }
}

export const adapter: AdapterFactory = (environment) => {
  const tracker = new StallionTracker({ fetcher: environment.fetcher, recorder: environment.recorder, userAgent: environment.userAgent });
  return {
    id: 'stallion-express', recordsSteps: true, steps: ['direct', 'retry'],
    track: (input, context) => tracker.fetch(input.number, context),
    recognize: (number, context) => recognizeFromLookup(() => tracker.fetch(number, context),
      () => accepted(() => normalizeStallionNumber(number))),
  };
};
