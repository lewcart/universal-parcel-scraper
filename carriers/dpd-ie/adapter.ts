import { accepted, recognizeFromLookup, type AdapterFactory, type TrackingContext } from '../../core/adapter/index.js';
import { BudgetExceededError, ChallengeError, IndeterminateError, SchemaError } from '../../core/errors/index.js';
import type { CarrierResult } from '../../core/result/index.js';
import { runSteps } from '../../core/runner/index.js';
import { firstAttemptMs, networkRetryStep } from '../../core/runner/networkRetry.js';
import { NOOP_RECORDER, type StepRecorder } from '../../core/telemetry/index.js';
import { decodeText, fetchBounded, userAgentOf } from '../../core/transport/index.js';
import { isDpdIeChallenge, normalizeDpdIeNumber, parseDpdIe, parseDpdIeAbsence, PROVIDER } from './parser.js';

// The tracker www.dpd.ie/tracking/ shows in a frame, with the frame's device type.
const ORIGIN = 'https://tracking.dpd.ie';
const RESULT = '/Home/SearchResult?deviceType=5';
// Where the tracker sends a consignment it does not have.
const ABSENT = '/Custom500.html?aspxerrorpath=/Home/SearchResult';
// The result page is about 10 kB.
const MAX_BYTES = 512 * 1024;
const REDIRECTS = [301, 302, 303, 307, 308];
const COOKIE = /^(ASP\.NET_SessionId|__cf_bm)=([A-Za-z0-9._~:=+/-]{1,512})(?:;|$)/;

/** The anonymous session the search opens; the result page reads the consignment from it. */
function sessionCookie(response: Response): string | null {
  const cookies = new Map<string, string>();
  for (const header of response.headers.getSetCookie()) {
    const match = COOKIE.exec(header);
    if (match) cookies.set(match[1]!, `${match[1]}=${match[2]}`);
  }
  return cookies.has('ASP.NET_SessionId') ? [...cookies.values()].join('; ') : null;
}

/** A redirect's target on the tracker's own host, as a path with its query, or null. */
function redirectPath(response: Response): string | null {
  const location = response.headers.get('location');
  if (!location) return null;
  try {
    const target = new URL(location, `${ORIGIN}/`);
    return target.origin === ORIGIN ? target.pathname + target.search : null;
  } catch {
    return null;
  }
}

export class DpdIeTracker {
  constructor(private readonly options: { fetcher?: typeof fetch; recorder?: StepRecorder; userAgent?: string } = {}) {}

  async fetch(raw: string, context: TrackingContext = {}): Promise<CarrierResult> {
    const number = normalizeDpdIeNumber(raw);
    const budgetMs = context.budgetMs ?? 15_000;
    // A request that fails to reach DPD Ireland, or hangs, gets one more try
    // with a new session: the first gets half of the budget.
    return runSteps({ carrier: 'dpd-ie', budgetMs, signal: context.signal, recorder: this.options.recorder ?? NOOP_RECORDER }, [
      { id: 'direct', run: ({ signal, remainingMs }) => this.lookup(number, signal, firstAttemptMs(remainingMs), budgetMs) },
      networkRetryStep(({ signal, remainingMs }) => this.lookup(number, signal, remainingMs, budgetMs)),
    ]);
  }

  private async lookup(number: string, signal: AbortSignal, timeoutMs: number, budgetMs: number): Promise<CarrierResult> {
    const deadline = performance.now() + timeoutMs;
    const userAgent = userAgentOf(this.options.userAgent);
    const read = async (path: string, cookie?: string) => {
      const left = deadline - performance.now();
      if (left <= 0) throw new BudgetExceededError(PROVIDER, budgetMs);
      signal.throwIfAborted();
      const { response, bytes } = await fetchBounded(`${ORIGIN}${path}`, { signal, headers: {
        'User-Agent': userAgent, Accept: 'text/html', ...(cookie ? { Cookie: cookie } : {}),
      } }, { provider: PROVIDER, timeoutMs: Math.max(1, Math.floor(left)), maxBytes: MAX_BYTES, redirect: 'manual',
        allowHttpStatuses: [...REDIRECTS, 404, 410], fetcher: this.options.fetcher });
      signal.throwIfAborted();
      // A missing page says nothing about the consignment.
      if (response.status === 404 || response.status === 410) throw new IndeterminateError(PROVIDER, 'DPD Ireland tracking is unavailable');
      return { response, html: decodeText(bytes) };
    };

    // The search stores the number in a new session and sends the browser to the result page.
    const search = await read(`/?${new URLSearchParams({ deviceType: '5', consignmentNumber: number })}`);
    if (!REDIRECTS.includes(search.response.status)) {
      if (isDpdIeChallenge(search.html)) throw new ChallengeError(PROVIDER, 'DPD Ireland asked for a browser check');
      throw new SchemaError(PROVIDER, 'DPD Ireland did not accept the consignment number');
    }
    const cookie = sessionCookie(search.response);
    if (redirectPath(search.response) !== RESULT || !cookie) {
      throw new IndeterminateError(PROVIDER, 'DPD Ireland did not open a tracking session');
    }
    const result = await read(RESULT, cookie);
    if (REDIRECTS.includes(result.response.status)) {
      if (redirectPath(result.response) !== ABSENT) throw new IndeterminateError(PROVIDER, 'DPD Ireland did not keep the tracking session');
      return parseDpdIeAbsence((await read(ABSENT)).html);
    }
    return parseDpdIe(result.html, number);
  }
}

export const adapter: AdapterFactory = environment => {
  const tracker = new DpdIeTracker({ fetcher: environment.fetcher, recorder: environment.recorder, userAgent: environment.userAgent });
  return {
    id: 'dpd-ie', recordsSteps: true, steps: ['direct', 'retry'],
    track: (input, context) => tracker.fetch(input.number, context),
    recognize: (number, context) => recognizeFromLookup(() => tracker.fetch(number, context),
      () => accepted(() => normalizeDpdIeNumber(number))),
  };
};
