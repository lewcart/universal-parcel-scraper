import { accepted, recognizeFromLookup, type AdapterFactory, type TrackingContext } from '../../core/adapter/index.js';
import { TransportError } from '../../core/errors/index.js';
import type { CarrierResult } from '../../core/result/index.js';
import { runSteps } from '../../core/runner/index.js';
import { firstAttemptMs, networkRetryStep } from '../../core/runner/networkRetry.js';
import { NOOP_RECORDER, type StepRecorder } from '../../core/telemetry/index.js';
import { decodeText, fetchBounded, userAgentOf } from '../../core/transport/index.js';
import { normalizePbtNumber, parsePbt, PBT_MAX_BYTES, PBT_RESULT, PROVIDER, readPbtRedirect } from './parser.js';

export { PBT_RESULT } from './parser.js';
const REDIRECTS = [301, 302, 303, 307, 308];
const GONE = [404, 410];

/** The tracking page's address for one whole number, as the tracking form opens it. */
export function pbtResultUrl(number: string): string {
  return `${PBT_RESULT}?${new URLSearchParams({ consignmentNumber: normalizePbtNumber(number) })}`;
}

export class PbtTracker {
  constructor(private readonly options: { fetcher?: typeof fetch; recorder?: StepRecorder; userAgent?: string } = {}) {}

  async fetch(raw: string, context: TrackingContext = {}): Promise<CarrierResult> {
    const number = normalizePbtNumber(raw);
    const read = async (signal: AbortSignal, timeoutMs: number): Promise<CarrierResult> => {
      const { response, bytes } = await fetchBounded(pbtResultUrl(number), { method: 'GET', signal, headers: {
        Accept: 'text/html', 'User-Agent': userAgentOf(this.options.userAgent),
      } }, { provider: PROVIDER, timeoutMs: Math.max(1, Math.floor(timeoutMs)), maxBytes: PBT_MAX_BYTES, redirect: 'manual',
        fetcher: this.options.fetcher, allowHttpStatuses: [...REDIRECTS, ...GONE] });
      if (REDIRECTS.includes(response.status)) readPbtRedirect(response.headers.get('location'), number);
      if (GONE.includes(response.status)) throw new TransportError(PROVIDER, 'PBT tracking page is unavailable');
      return parsePbt(decodeText(bytes), number);
    };
    // A request that fails to reach the site, or hangs, gets one more try: the
    // first gets half of the budget, so the retry fits in the rest.
    return runSteps({ carrier: 'pbt', budgetMs: context.budgetMs ?? 15_000, signal: context.signal,
      recorder: this.options.recorder ?? NOOP_RECORDER }, [
      { id: 'direct', run: ({ signal, remainingMs }) => read(signal, firstAttemptMs(remainingMs)) },
      networkRetryStep(({ signal, remainingMs }) => read(signal, remainingMs)),
    ]);
  }
}

export const adapter: AdapterFactory = (environment) => {
  const tracker = new PbtTracker({ fetcher: environment.fetcher, recorder: environment.recorder, userAgent: environment.userAgent });
  return {
    id: 'pbt', recordsSteps: true, steps: ['direct', 'retry'],
    track: (input, context) => tracker.fetch(input.number, context),
    recognize: (number, context) => recognizeFromLookup(() => tracker.fetch(number, context),
      () => accepted(() => normalizePbtNumber(number))),
  };
};
