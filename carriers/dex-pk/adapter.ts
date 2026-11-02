import { accepted, recognizeFromLookup, type AdapterFactory, type TrackingContext } from '../../core/adapter/index.js';
import { CarrierError, ChallengeError, SchemaError, TransportError, UpstreamHttpError, UpstreamNetworkError } from '../../core/errors/index.js';
import type { CarrierResult } from '../../core/result/index.js';
import { runSteps } from '../../core/runner/index.js';
import { firstAttemptMs, networkRetryStep } from '../../core/runner/networkRetry.js';
import { NOOP_RECORDER, type StepRecorder } from '../../core/telemetry/index.js';
import { decodeText, fetchBounded, userAgentOf } from '../../core/transport/index.js';
import {
  DEX_PK_HISTORY, DEX_PK_MAX_BYTES, DEX_PK_SEARCH, normalizeDexPkNumber, parseDexPkHistory, parseDexPkSearch, PROVIDER,
} from './parser.js';

const REDIRECTS = [301, 302, 303, 307, 308];
const CHALLENGE = /x5secdata|_____tmd_____|\/punish\b|baxia|FAIL_SYS_USER_VALIDATE|nc_1_n1z|_cf_chl_opt|<title>\s*(?:Access Denied|Just a moment|验证)/i;

/** Keep the failure taxonomy and network retry marker without requests, replies or raw causes. */
function withoutDiagnostics(error: unknown): Error {
  if (error instanceof UpstreamNetworkError) return new UpstreamNetworkError(PROVIDER, undefined);
  if (error instanceof UpstreamHttpError) return new UpstreamHttpError(PROVIDER, error.status, error.retryAfterMs);
  if (error instanceof CarrierError) return new CarrierError(error.kind, PROVIDER, 'DEX Pakistan tracking failed', {
    status: error.status, retryAfterMs: error.retryAfterMs,
    ...(['response_too_large', 'history_unavailable'].includes(error.reason ?? '') ? { reason: error.reason } : {}),
  });
  return new TransportError(PROVIDER, 'DEX Pakistan request failed');
}

/** The runner can also see a caller's abort reason; retain no raw error at the recording boundary. */
function privateRecorder(recorder: StepRecorder): StepRecorder {
  return {
    step: (record) => recorder.step({ ...record,
      ...(record.error === undefined ? {} : { error: withoutDiagnostics(record.error) }),
      ...(record.fallbackError === undefined ? {} : { fallbackError: withoutDiagnostics(record.fallbackError) }),
    }),
    lookup: (record) => recorder.lookup({ ...record,
      ...(record.error === undefined ? {} : { error: withoutDiagnostics(record.error) }),
    }),
  };
}

export class DexPkTracker {
  constructor(private readonly options: { fetcher?: typeof fetch; recorder?: StepRecorder; userAgent?: string } = {}) {}

  private async read(number: string, signal: AbortSignal, budgetMs: number): Promise<CarrierResult> {
    const deadline = performance.now() + budgetMs;
    const send = async (url: string, fields: object): Promise<unknown> => {
      const remaining = Math.floor(deadline - performance.now());
      if (remaining < 1) throw new UpstreamNetworkError(PROVIDER, undefined);
      let result: Awaited<ReturnType<typeof fetchBounded>>;
      try {
        result = await fetchBounded(url, { method: 'POST', signal, headers: {
          Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': userAgentOf(this.options.userAgent),
        }, body: JSON.stringify(fields) }, { provider: PROVIDER, timeoutMs: remaining, maxBytes: DEX_PK_MAX_BYTES,
          redirect: 'manual', allowHttpStatuses: [...REDIRECTS, 404, 410], fetcher: this.options.fetcher });
      } catch (error) {
        throw withoutDiagnostics(error);
      }
      const body = decodeText(result.bytes);
      if (CHALLENGE.test(body.slice(0, 16_000))) throw new ChallengeError(PROVIDER, 'DEX Pakistan answered with a bot check');
      // Both guest routes answer unknown numbers with HTTP 200; a missing route is a transport failure.
      if (result.response.status !== 200) throw new TransportError(PROVIDER, 'DEX Pakistan tracking route is unavailable', { status: result.response.status });
      try { return JSON.parse(body) as unknown; }
      catch { throw new SchemaError(PROVIDER, 'DEX Pakistan returned a reply that is not JSON'); }
    };
    parseDexPkSearch(await send(DEX_PK_SEARCH, { trackingNumbers: [number] }), number);
    signal.throwIfAborted();
    return parseDexPkHistory(await send(DEX_PK_HISTORY, { trackingNumber: number }), number);
  }

  async fetch(raw: string, context: TrackingContext = {}): Promise<CarrierResult> {
    const number = normalizeDexPkNumber(raw);
    return runSteps({ carrier: 'dex-pk', budgetMs: context.budgetMs ?? 20_000, signal: context.signal,
      recorder: privateRecorder(this.options.recorder ?? NOOP_RECORDER) }, [
      { id: 'direct', run: ({ signal, remainingMs }) => this.read(number, signal, firstAttemptMs(remainingMs)) },
      networkRetryStep(({ signal, remainingMs }) => this.read(number, signal, remainingMs)),
    ]);
  }
}

export const adapter: AdapterFactory = (environment) => {
  const tracker = new DexPkTracker({ fetcher: environment.fetcher, recorder: environment.recorder, userAgent: environment.userAgent });
  return {
    id: 'dex-pk', recordsSteps: true, steps: ['direct', 'retry'],
    track: (input, context) => tracker.fetch(input.number, context),
    recognize: (number, context) => recognizeFromLookup(() => tracker.fetch(number, context),
      () => accepted(() => normalizeDexPkNumber(number))),
  };
};
