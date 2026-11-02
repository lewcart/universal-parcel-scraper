import { accepted, recognizeFromLookup, type AdapterFactory, type TrackingContext } from '../../core/adapter/index.js';
import { CarrierError, ChallengeError, IndeterminateError, NotFoundError, SchemaError, UpstreamHttpError, UpstreamNetworkError } from '../../core/errors/index.js';
import type { CarrierResult } from '../../core/result/index.js';
import { runSteps } from '../../core/runner/index.js';
import { firstAttemptMs, networkRetryStep } from '../../core/runner/networkRetry.js';
import { NOOP_RECORDER, type StepRecorder } from '../../core/telemetry/index.js';
import { decodeText, fetchBounded, userAgentOf } from '../../core/transport/index.js';
import { isRecord } from '../../core/types.js';
import { parseRozetkaHistory, parseRozetkaSummary, PROVIDER, ROZETKA_MAX_BYTES, rozetkaRequestNumber } from './parser.js';

export const ROZETKA_API = 'https://rz-delivery.rozetka.ua/api/';
export const ROZETKA_PAGE = 'https://rozetka.delivery/tracking/parcel';
const INSPECT = [301, 302, 303, 307, 308, 404, 410];
const BLOCKED = /_cf_chl_opt|cf-turnstile|<title>\s*(?:Just a moment|Attention Required|Access Denied|Request Rejected)|captcha|access denied/i;

/** The same whole, dashed identifier that the public form sends and shares. */
export function rozetkaResultUrl(raw: string): string {
  return `${ROZETKA_PAGE}?${new URLSearchParams({ parcel_id: rozetkaRequestNumber(raw) })}`;
}

/** Transport errors cross the recorder boundary with no request, headers, body, URL or raw cause. */
function safeTransportError(error: unknown): Error {
  if (error instanceof UpstreamNetworkError) return new UpstreamNetworkError(PROVIDER, undefined);
  if (error instanceof UpstreamHttpError) return new UpstreamHttpError(PROVIDER, error.status, error.retryAfterMs);
  if (error instanceof CarrierError) return new CarrierError(error.kind, PROVIDER, 'ROZETKA Delivery could not read the tracking response', {
    status: error.status, retryAfterMs: error.retryAfterMs,
    ...(error.reason === 'response_too_large' ? { reason: error.reason } : {}),
  });
  return new CarrierError('transport', PROVIDER, 'ROZETKA Delivery could not read the tracking response');
}

function payloadOf(bytes: Uint8Array, status: number, summary: boolean): unknown {
  const text = decodeText(bytes).replace(/^\uFEFF/, '');
  if (BLOCKED.test(text.slice(0, 64_000)) && /^\s*</.test(text)) throw new ChallengeError(PROVIDER, 'ROZETKA Delivery answered with a block page');
  if (status >= 300 && status < 400) throw new IndeterminateError(PROVIDER, 'ROZETKA Delivery redirected its tracking service');
  if (status === 410) throw new IndeterminateError(PROVIDER, 'ROZETKA Delivery no longer serves this tracking response', { reason: 'history_expired' });
  if (!text.trim()) throw new IndeterminateError(PROVIDER, 'ROZETKA Delivery returned an empty response');
  let payload: unknown;
  try { payload = JSON.parse(text); } catch {
    throw new SchemaError(PROVIDER, 'ROZETKA Delivery returned a reply that is not JSON');
  }
  // Only this provider-specific overview reply establishes an unknown record.
  // An absent history after a positive overview is inconclusive.
  if (status === 404) {
    if (summary && isRecord(payload) && payload.statusCode === 404 && payload.error === 'Not Found'
      && payload.message === 'Експрес-накладна не знайдена') throw new NotFoundError(PROVIDER);
    throw new IndeterminateError(PROVIDER, 'ROZETKA Delivery did not return the requested tracking response');
  }
  if (status !== 200) throw new IndeterminateError(PROVIDER, 'ROZETKA Delivery returned no tracking result');
  return payload;
}

export class RozetkaDeliveryTracker {
  constructor(private readonly options: { fetcher?: typeof fetch; recorder?: StepRecorder; userAgent?: string } = {}) {}

  async fetch(raw: string, context: TrackingContext = {}): Promise<CarrierResult> {
    const number = rozetkaRequestNumber(raw);
    context.signal?.throwIfAborted();
    const read = async (signal: AbortSignal, timeoutMs: number): Promise<CarrierResult> => {
      const deadline = performance.now() + timeoutMs;
      const attemptSignal = AbortSignal.any([signal, AbortSignal.timeout(Math.max(1, Math.floor(timeoutMs)))]);
      const get = async (path: string, summary: boolean): Promise<unknown> => {
        let answer: Awaited<ReturnType<typeof fetchBounded>>;
        try {
          answer = await fetchBounded(`${ROZETKA_API}${path}`, { method: 'GET', signal: attemptSignal, headers: {
            Accept: 'application/json', 'User-Agent': userAgentOf(this.options.userAgent),
          } }, { provider: PROVIDER, timeoutMs: Math.max(1, Math.floor(deadline - performance.now())),
            maxBytes: ROZETKA_MAX_BYTES, redirect: 'manual', allowHttpStatuses: INSPECT, fetcher: this.options.fetcher });
        } catch (error) { throw safeTransportError(error); }
        return payloadOf(answer.bytes, answer.response.status, summary);
      };
      const summary = parseRozetkaSummary(await get(`track/public/${number}`, true), number);
      const query = new URLSearchParams({ id: summary.number, sort: 'asc' });
      return parseRozetkaHistory(await get(`track/status-group?${query}`, false), summary);
    };
    return runSteps({ carrier: 'rozetka-delivery', budgetMs: context.budgetMs ?? 15_000, signal: context.signal,
      recorder: this.options.recorder ?? NOOP_RECORDER }, [
      { id: 'direct', run: ({ signal, remainingMs }) => read(signal, firstAttemptMs(remainingMs)) },
      networkRetryStep(({ signal, remainingMs }) => read(signal, remainingMs)),
    ]);
  }
}

export const adapter: AdapterFactory = environment => {
  const tracker = new RozetkaDeliveryTracker({ fetcher: environment.fetcher, recorder: environment.recorder, userAgent: environment.userAgent });
  return {
    id: 'rozetka-delivery', recordsSteps: true, steps: ['direct', 'retry'],
    track: (input, context) => tracker.fetch(input.number, context),
    recognize: (number, context) => recognizeFromLookup(() => tracker.fetch(number, context),
      () => accepted(() => rozetkaRequestNumber(number))),
  };
};
