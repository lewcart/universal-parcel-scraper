import type { AdapterFactory, TrackingContext } from '../../core/adapter/index.js';
import { ChallengeError, SchemaError, TransportError, UpstreamHttpError, UpstreamNetworkError } from '../../core/errors/index.js';
import type { CarrierResult } from '../../core/result/index.js';
import { runSteps } from '../../core/runner/index.js';
import { firstAttemptMs, networkRetryStep } from '../../core/runner/networkRetry.js';
import { NOOP_RECORDER, type StepRecorder } from '../../core/telemetry/index.js';
import { decodeText, fetchBounded, parseJsonBytes, userAgentOf } from '../../core/transport/index.js';
import { confirmDsvShipment, DSV_MAX_BYTES, normalizeDsvNumber, parseDsvStatuses, pickDsvShipment, PROVIDER } from './parser.js';

// The services the shipment page at mydsv.com/track-shipment calls without an account.
export const DSV_SEARCH_ENDPOINT = 'https://mydsv.com/app/search/publicShipmentList';
export const DSV_SHIPMENT_ENDPOINT = 'https://mydsv.com/app/search/shipment/';
export const DSV_STATUSES_ENDPOINT = 'https://mydsv.com/app/search/shipment/new-statuses/';
// A web application firewall or CDN block page.
const BLOCKED = /<title>\s*(?:Request Rejected|Access Denied|Just a moment|Attention Required)|The requested URL was rejected|Incapsula incident|cf-chl-|cf-turnstile|_cf_chl_opt/i;

export class DsvTracker {
  constructor(private readonly options: { fetcher?: typeof fetch; recorder?: StepRecorder; userAgent?: string } = {}) {}

  /**
   * One JSON read. The shipment's key opens its details, so a failed read by
   * key keeps neither the address nor the reply on its error.
   */
  private async json(url: string, signal: AbortSignal, timeoutMs: number, byKey: boolean): Promise<unknown> {
    let bytes: Uint8Array;
    try {
      ({ bytes } = await fetchBounded(url, { signal, headers: { Accept: 'application/json', 'User-Agent': userAgentOf(this.options.userAgent) } },
        { provider: PROVIDER, timeoutMs: Math.max(1, Math.floor(timeoutMs)), maxBytes: DSV_MAX_BYTES, fetcher: this.options.fetcher }));
    } catch (error) {
      // A missing route is not a missing shipment: the search answers unknown numbers with an empty list.
      if (error instanceof UpstreamHttpError && [404, 410].includes(error.status)) {
        throw new TransportError(PROVIDER, 'myDSV tracking service is unavailable', byKey ? undefined : { cause: error });
      }
      if (byKey && error instanceof UpstreamHttpError) throw new UpstreamHttpError(PROVIDER, error.status, error.retryAfterMs);
      if (byKey && error instanceof UpstreamNetworkError) throw new UpstreamNetworkError(PROVIDER, error.cause);
      throw error;
    }
    try { return parseJsonBytes(bytes, PROVIDER); }
    catch (cause) {
      if (BLOCKED.test(decodeText(bytes.subarray(0, 64_000)))) throw new ChallengeError(PROVIDER, 'myDSV answered with a block page');
      throw new SchemaError(PROVIDER, 'myDSV returned invalid tracking JSON', byKey ? undefined : { cause });
    }
  }

  async fetch(raw: string, context: TrackingContext = {}): Promise<CarrierResult> {
    const number = normalizeDsvNumber(raw);
    const search = `${DSV_SEARCH_ENDPOINT}?${new URLSearchParams({ q: number })}`;
    // The search, then the history by the shipment's key, and its details
    // first when only they can tie the shipment to the number.
    const read = async (signal: AbortSignal, timeoutMs: number): Promise<CarrierResult> => {
      const deadline = performance.now() + timeoutMs;
      const left = () => Math.max(1, deadline - performance.now());
      const shipment = pickDsvShipment(await this.json(search, signal, left(), false), number);
      const key = encodeURIComponent(shipment.key);
      if (!shipment.own) {
        const details = `${DSV_SHIPMENT_ENDPOINT}${key}?${new URLSearchParams({ detailedMilestones: 'true' })}`;
        confirmDsvShipment(await this.json(details, signal, left(), true), number);
      }
      return parseDsvStatuses(await this.json(`${DSV_STATUSES_ENDPOINT}${key}`, signal, left(), true), shipment);
    };
    // A lookup that fails to reach myDSV, or hangs, gets one more try: the
    // first gets half of the budget, so the retry fits in the rest.
    return runSteps({ carrier: 'dsv', budgetMs: context.budgetMs ?? 15_000, signal: context.signal,
      recorder: this.options.recorder ?? NOOP_RECORDER }, [
      { id: 'direct', run: ({ signal, remainingMs }) => read(signal, firstAttemptMs(remainingMs)) },
      networkRetryStep(({ signal, remainingMs }) => read(signal, remainingMs)),
    ]);
  }
}

export const adapter: AdapterFactory = (environment) => {
  const tracker = new DsvTracker({ fetcher: environment.fetcher, recorder: environment.recorder, userAgent: environment.userAgent });
  return {
    id: 'dsv', recordsSteps: true, steps: ['direct', 'retry'],
    track: (input, context) => tracker.fetch(input.number, context),
  };
};
