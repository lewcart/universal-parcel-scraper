import type { AdapterFactory, TrackingContext } from '../../core/adapter/index.js';
import { BudgetExceededError, ChallengeError, IndeterminateError, RateLimitedError, SchemaError, UpstreamHttpError, UpstreamNetworkError } from '../../core/errors/index.js';
import { runSteps, type StepContext } from '../../core/runner/index.js';
import { firstAttemptMs, isNetworkFailure } from '../../core/runner/networkRetry.js';
import { errorTypeOf, NOOP_RECORDER, outcomeOf, safeRecorder, type StepRecorder } from '../../core/telemetry/index.js';
import { decodeText, fetchBounded, parseJsonBytes, userAgentOf } from '../../core/transport/index.js';
import { isRecord } from '../../core/types.js';
import { EcmsExpressOcr } from './ocr.js';
import { ECMS_MAX_BYTES, isEcmsVerificationFailure, normalizeEcmsExpressNumber, parseEcmsExpress, PROVIDER } from './parser.js';

export { normalizeEcmsExpressNumber, parseEcmsExpress } from './parser.js';

const ORIGIN = 'https://www.ecmsglobal.com';
type Solver = (bytes: Uint8Array, signal: AbortSignal) => Promise<string>;
class PictureVerificationError extends ChallengeError {}

export class EcmsExpressTracker {
  private readonly ocr = new EcmsExpressOcr();
  constructor(private readonly options: { fetcher?: typeof fetch; recorder?: StepRecorder; userAgent?: string; solveCaptcha?: Solver } = {}) {}

  async fetch(raw: string, context: TrackingContext = {}) {
    const number = normalizeEcmsExpressNumber(raw);
    const recorder = safeRecorder(this.options.recorder ?? NOOP_RECORDER);
    // On the first try each request gets half of the time left, so one that hangs leaves time for the retry.
    const lookup = async ({ signal, remainingMs, attempt }: StepContext, firstTry: boolean) => {
      const deadline = performance.now() + remainingMs;
      const left = () => {
        signal.throwIfAborted();
        const remaining = Math.floor(deadline - performance.now());
        if (remaining < 1) throw new BudgetExceededError(PROVIDER, remainingMs);
        return remaining;
      };
      const failure = (error: unknown): unknown => {
        if (signal.aborted && !context.signal?.aborted) return new BudgetExceededError(PROVIDER, remainingMs);
        // Request diagnostics can contain the single-use verification sign and answer.
        if (error instanceof UpstreamHttpError) return new UpstreamHttpError(error.provider, error.status, error.retryAfterMs);
        if (error instanceof UpstreamNetworkError) return new UpstreamNetworkError(error.provider, error.cause);
        return error;
      };
      // Each request and the picture's reading is a step of its own, so a hang shows where it is.
      const recorded = async <T>(step: string, run: () => Promise<T>): Promise<T> => {
        const started = performance.now();
        const record = (error?: unknown) => recorder.step({ carrier: 'ecms-express', step, attempt,
          outcome: error === undefined ? 'ok' : outcomeOf(error), errorType: error === undefined ? null : errorTypeOf(error),
          durationMs: Math.max(0, performance.now() - started), fallbackFrom: null, fallbackReason: null, fallbackErrorType: null,
          ...(error === undefined ? {} : { error }) });
        try {
          const value = await run();
          record();
          return value;
        } catch (error) {
          const failed = failure(error);
          record(failed);
          throw failed;
        }
      };
      const request = (step: string, path: string, query: Record<string, string> = {}): Promise<unknown> => recorded(step, async () => {
        const { bytes } = await fetchBounded(`${ORIGIN}/brige/${path}?${new URLSearchParams(query)}`, { method: 'POST', signal,
          headers: { Accept: 'application/json', Referer: `${ORIGIN}/en-us/tracking.html`, 'User-Agent': userAgentOf(this.options.userAgent) } },
        { provider: PROVIDER, timeoutMs: firstTry ? firstAttemptMs(left()) : left(), maxBytes: ECMS_MAX_BYTES, fetcher: this.options.fetcher });
        left();
        if (/^\s*</.test(decodeText(bytes))) throw new ChallengeError(PROVIDER, 'ECMS returned a verification page');
        let payload: unknown;
        try { payload = parseJsonBytes(bytes, PROVIDER); }
        catch { throw new SchemaError(PROVIDER, 'ECMS returned unreadable tracking JSON'); }
        if (!isRecord(payload) || typeof payload.status !== 'number') throw new SchemaError(PROVIDER, 'ECMS returned an invalid envelope');
        if (payload.status === 429) throw new RateLimitedError(PROVIDER);
        if (payload.status === 401 || payload.status === 403) throw new ChallengeError(PROVIDER, 'ECMS refused verification');
        return payload;
      });
      const verifiedData = (payload: unknown): unknown => {
        if (!isRecord(payload) || typeof payload.message !== 'string') throw new SchemaError(PROVIDER, 'ECMS changed its verification reply');
        if (payload.status !== 200 || payload.message !== 'SUCCESS') throw new IndeterminateError(PROVIDER, 'ECMS could not open verification');
        return payload.data;
      };
      try {
        const challenge = verifiedData(await request('challenge', 'math/captcha/get/base64', { v: String(Date.now()) }));
        if (!isRecord(challenge) || typeof challenge.signKey !== 'string' || !/^[a-f0-9-]{36}$/i.test(challenge.signKey)
          || typeof challenge.base64Data !== 'string' || challenge.base64Data.length > 70_000
          || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/i.test(challenge.base64Data)) throw new SchemaError(PROVIDER, 'ECMS changed its picture challenge');
        const bytes = Buffer.from(challenge.base64Data.slice(challenge.base64Data.indexOf(',') + 1), 'base64');
        const answer = await recorded('solve', () => (this.options.solveCaptcha ?? this.ocr.solve.bind(this.ocr))(bytes, signal));
        left();
        if (!/^(?:-?[0-9]|1[0-8])$/.test(answer)) throw new PictureVerificationError(PROVIDER, 'ECMS picture challenge could not be read');
        const checked = await request('check', 'math/captcha/check', { captchaCode: answer, signKey: challenge.signKey });
        if (isRecord(checked) && checked.status === 200 && checked.message === 'check fail') throw new PictureVerificationError(PROVIDER, 'ECMS rejected the picture answer');
        const sign = verifiedData(checked);
        if (typeof sign !== 'string' || !/^[A-Za-z0-9+/=_-]{16,512}$/.test(sign)) throw new SchemaError(PROVIDER, 'ECMS returned an invalid verification sign');
        const payload = await request('history', 'getTarcking', { orderNumber: number, verifySign: sign });
        if (isEcmsVerificationFailure(payload)) throw new PictureVerificationError(PROVIDER, 'ECMS rejected the verification sign');
        return parseEcmsExpress(payload, number);
      } catch (error) {
        throw failure(error);
      }
    };
    return runSteps({ carrier: 'ecms-express', budgetMs: context.budgetMs ?? 20_000, signal: context.signal, recorder }, [
      { id: 'direct', run: step => lookup(step, true) },
      // A fresh challenge after a refused answer, or after a request that hung or lost its connection.
      { id: 'retry', recovers: error => error instanceof PictureVerificationError || isNetworkFailure(error), run: step => lookup(step, false) },
    ]);
  }

  close() { return this.ocr.close(); }
}

export const adapter: AdapterFactory = environment => {
  const tracker = new EcmsExpressTracker({ fetcher: environment.fetcher, recorder: environment.recorder, userAgent: environment.userAgent });
  return { id: 'ecms-express', recordsSteps: true, steps: ['direct', 'retry'], track: (input, context) => tracker.fetch(input.number, context) };
};
