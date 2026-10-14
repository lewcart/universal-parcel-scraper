import type { AdapterFactory, TrackingContext } from '../../core/adapter/index.js';
import { BudgetExceededError, ChallengeError, IndeterminateError, SchemaError, TransportError, UpstreamHttpError,
  UpstreamNetworkError } from '../../core/errors/index.js';
import type { CarrierResult } from '../../core/result/index.js';
import { runSteps } from '../../core/runner/index.js';
import { firstAttemptMs, networkRetryStep } from '../../core/runner/networkRetry.js';
import { NOOP_RECORDER, type StepRecorder } from '../../core/telemetry/index.js';
import { decodeText, fetchBounded, parseJsonBytes, userAgentOf } from '../../core/transport/index.js';
import { isRecord } from '../../core/types.js';
import { confirmDsvShipment, DSV_MAX_BYTES, normalizeDsvNumber, parseDsvStatuses, pickDsvShipment, PROVIDER } from './parser.js';
import { parseDsvPuzzles, solveDsvPuzzles } from './puzzle.js';
import { notFound, parseDsvSchenkerShipment, pickDsvSchenkerShipment } from './schenker.js';

// The services the shipment page at mydsv.com/track-shipment calls without an account.
export const DSV_SEARCH_ENDPOINT = 'https://mydsv.com/app/search/publicShipmentList';
export const DSV_SHIPMENT_ENDPOINT = 'https://mydsv.com/app/search/shipment/';
export const DSV_STATUSES_ENDPOINT = 'https://mydsv.com/app/search/shipment/new-statuses/';
// The former DB Schenker tracker's API, behind the page at www.dsv.com/mydsv/tracking-public.
export const DSV_SCHENKER_ENDPOINT = 'https://www.dsv.com/nges-portal/api/public/tracking-public';
const DEFAULT_BUDGET_MS = 15_000;
// The tracker's answers when the number matches none of its shipments or reference patterns.
const SCHENKER_NOT_FOUND = /^TRACKING-BADREQ-(?:SHIPMENT_NOT_FOUND|NO_MATCHING_PATTERN_FOUND)$/;
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

  /**
   * One read from the former DB Schenker tracker. It answers every request
   * with HTTP 429 and a proof-of-work puzzle; the same request with the
   * solution gets the reply. The solution stays out of failure diagnostics.
   */
  private async schenker(path: string, signal: AbortSignal, deadline: number, budgetMs: number): Promise<unknown> {
    const url = `${DSV_SCHENKER_ENDPOINT}${path}`;
    const headers = { Accept: 'application/json', 'Accept-Language': 'en', 'User-Agent': userAgentOf(this.options.userAgent) };
    const left = () => {
      const ms = Math.floor(deadline - performance.now());
      if (ms < 1) throw new BudgetExceededError(PROVIDER, budgetMs);
      return ms;
    };
    const request = async (extra: Record<string, string>, allow: readonly number[]) => {
      try {
        return await fetchBounded(url, { signal, headers: { ...headers, ...extra } },
          { provider: PROVIDER, timeoutMs: left(), maxBytes: DSV_MAX_BYTES, allowHttpStatuses: allow, fetcher: this.options.fetcher });
      } catch (error) {
        if (error instanceof UpstreamHttpError) throw new UpstreamHttpError(PROVIDER, error.status, error.retryAfterMs);
        if (error instanceof UpstreamNetworkError) throw new UpstreamNetworkError(PROVIDER, new Error('DSV\'s former DB Schenker tracker did not answer'));
        throw error;
      }
    };
    const json = (bytes: Uint8Array): unknown => {
      try { return parseJsonBytes(bytes, PROVIDER); }
      catch {
        if (BLOCKED.test(decodeText(bytes.subarray(0, 64_000)))) throw new ChallengeError(PROVIDER, 'DSV answered with a block page');
        throw new SchemaError(PROVIDER, 'DSV\'s former DB Schenker tracker returned invalid tracking JSON');
      }
    };
    const first = await request({}, [404, 429]);
    // A missing route is not a missing shipment.
    if (first.response.status === 404) throw new TransportError(PROVIDER, 'DSV\'s former DB Schenker tracker is unavailable');
    if (first.response.status !== 429) return json(first.bytes);
    const puzzle = first.response.headers.get('captcha-puzzle');
    if (!puzzle) throw new UpstreamHttpError(PROVIDER, 429);
    const solution = await solveDsvPuzzles(parseDsvPuzzles(puzzle, PROVIDER), signal, deadline, budgetMs, PROVIDER);
    signal.throwIfAborted();
    const { response, bytes } = await request({ 'Captcha-Solution': solution }, [400, 404, 422, 429]);
    if (response.status === 200) return json(bytes);
    if (response.status === 404) notFound();
    if (response.status === 400) {
      let payload: unknown;
      try { payload = parseJsonBytes(bytes, PROVIDER); } catch { payload = null; }
      if (isRecord(payload) && typeof payload.code === 'string' && SCHENKER_NOT_FOUND.test(payload.code)) notFound();
      throw new IndeterminateError(PROVIDER, 'DSV\'s former DB Schenker tracker refused the lookup');
    }
    // Another puzzle, or a refusal of the solution.
    if (response.status === 422 || response.headers.get('captcha-puzzle')) {
      throw new ChallengeError(PROVIDER, 'DSV\'s former DB Schenker tracker refused the solved puzzle');
    }
    throw new UpstreamHttpError(PROVIDER, response.status);
  }

  /** The former DB Schenker tracker: its search, then the details of the one road shipment it finds. */
  private async schenkerShipment(number: string, signal: AbortSignal, remainingMs: number): Promise<CarrierResult> {
    const deadline = performance.now() + remainingMs;
    const id = pickDsvSchenkerShipment(
      await this.schenker(`/shipments?${new URLSearchParams({ query: number })}`, signal, deadline, remainingMs), number);
    // The page sends the id as it is, colons and commas included.
    return parseDsvSchenkerShipment(await this.schenker(`/shipments/land/${id}`, signal, deadline, remainingMs), number, id);
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
    // first gets half of the budget, so the retry fits in the rest. A number
    // myDSV does not know goes to the former DB Schenker tracker.
    return runSteps({ carrier: 'dsv', budgetMs: context.budgetMs ?? DEFAULT_BUDGET_MS, signal: context.signal,
      recorder: this.options.recorder ?? NOOP_RECORDER }, [
      { id: 'direct', run: ({ signal, remainingMs }) => read(signal, firstAttemptMs(remainingMs)) },
      networkRetryStep(({ signal, remainingMs }) => read(signal, remainingMs)),
      { id: 'schenker', recovers: notInMyDsv, run: ({ signal, remainingMs }) => this.schenkerShipment(number, signal, remainingMs) },
    ]);
  }
}

/** myDSV's search answered and does not know the number. */
function notInMyDsv(error: unknown): boolean {
  return error instanceof IndeterminateError && error.reason === 'portal_not_found';
}

export const adapter: AdapterFactory = (environment) => {
  const tracker = new DsvTracker({ fetcher: environment.fetcher, recorder: environment.recorder, userAgent: environment.userAgent });
  return {
    id: 'dsv', recordsSteps: true, steps: ['direct', 'retry', 'schenker'],
    track: (input, context) => tracker.fetch(input.number, context),
  };
};
