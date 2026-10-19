import { accepted, recognizeFromLookup, type AdapterFactory, type Recognition, type TrackingContext } from '../../core/adapter/index.js';
import { NoHistoryError, TransportError } from '../../core/errors/index.js';
import type { CarrierResult } from '../../core/result/index.js';
import { runSteps } from '../../core/runner/index.js';
import { firstAttemptMs, networkRetryStep } from '../../core/runner/networkRetry.js';
import { NOOP_RECORDER, type StepRecorder } from '../../core/telemetry/index.js';
import { decodeText, fetchBounded, userAgentOf } from '../../core/transport/index.js';
import { FORZA_MAX_BYTES, normalizeForzaNumber, parseForzaReply, PROVIDER } from './parser.js';

/** The ASP.NET page method the tracking page on rastreo.forzadelivery.com posts its lookups to. */
export const FORZA_API = 'https://rastreo.forzadelivery.com/fd2/Home.aspx/API';
const METHOD = 'GetNewDeliveryTracking';
const REDIRECTS = [301, 302, 303, 307, 308];
// A missing route is not a missing guía.
const GONE = [404, 410];

/**
 * The body the page sends for a guía typed in: the method's path and its
 * parameters as a string of JSON, with the FD series apart from the digits
 * and no reference or recipient phone.
 */
export function forzaLookupBody(number: string): string {
  return JSON.stringify({ path: `Tracking/${METHOD}`, data: JSON.stringify({ Method: METHOD,
    Params: { GuideSerie: 'FD', GuideNumber: number.slice(2), TicketNumber: '', NirPhone: 0, Phone: 0 } }) });
}

export class ForzaTracker {
  constructor(private readonly options: { fetcher?: typeof fetch; recorder?: StepRecorder; userAgent?: string } = {}) {}

  async fetch(raw: string, context: TrackingContext = {}): Promise<CarrierResult> {
    const number = normalizeForzaNumber(raw);
    const read = async (signal: AbortSignal, timeoutMs: number): Promise<CarrierResult> => {
      const { response, bytes } = await fetchBounded(FORZA_API, { method: 'POST', signal, headers: {
        Accept: 'application/json, text/plain, */*', 'Content-Type': 'application/json; charset=utf-8', 'User-Agent': userAgentOf(this.options.userAgent),
      }, body: forzaLookupBody(number) }, { provider: PROVIDER, timeoutMs: Math.max(1, Math.floor(timeoutMs)),
        maxBytes: FORZA_MAX_BYTES, redirect: 'manual', fetcher: this.options.fetcher, allowHttpStatuses: [...REDIRECTS, ...GONE] });
      if (REDIRECTS.includes(response.status)) throw new TransportError(PROVIDER, 'Forza redirected its tracking lookup', { status: response.status });
      // The method answers an unknown guía with HTTP 200; a 404 is a moved route.
      if (GONE.includes(response.status)) throw new TransportError(PROVIDER, 'Forza’s tracking lookup is unavailable', { status: response.status });
      return parseForzaReply(decodeText(bytes), number);
    };
    // A read that fails to reach the tracker, or hangs, gets one more: the
    // first gets half of the budget, so the retry fits in the rest. An HTTP
    // status is never sent again.
    return runSteps({ carrier: 'forza-delivery', budgetMs: context.budgetMs ?? 15_000, signal: context.signal,
      recorder: this.options.recorder ?? NOOP_RECORDER }, [
      { id: 'direct', run: ({ signal, remainingMs }) => read(signal, firstAttemptMs(remainingMs)) },
      networkRetryStep(({ signal, remainingMs }) => read(signal, remainingMs)),
    ]);
  }

  /** Known when the tracker has the guía, even an older one it keeps without its milestones. */
  async recognize(number: string, context: TrackingContext = {}): Promise<Recognition> {
    try {
      return await recognizeFromLookup(() => this.fetch(number, context), () => accepted(() => normalizeForzaNumber(number)));
    } catch (error) {
      if (error instanceof NoHistoryError) return { known: true, lastActivityAt: null };
      throw error;
    }
  }
}

export const adapter: AdapterFactory = (environment) => {
  const tracker = new ForzaTracker({ fetcher: environment.fetcher, recorder: environment.recorder, userAgent: environment.userAgent });
  return {
    id: 'forza-delivery', recordsSteps: true, steps: ['direct', 'retry'],
    track: (input, context) => tracker.fetch(input.number, context),
    recognize: (number, context) => tracker.recognize(number, context),
  };
};
