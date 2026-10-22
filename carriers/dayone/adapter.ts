import { createHash } from 'node:crypto';
import type { AdapterFactory, TrackingContext } from '../../core/adapter/index.js';
import { ChallengeError, IndeterminateError, SchemaError, TransportError } from '../../core/errors/index.js';
import type { CarrierResult } from '../../core/result/index.js';
import { runSteps } from '../../core/runner/index.js';
import { firstAttemptMs, networkRetryStep } from '../../core/runner/networkRetry.js';
import { NOOP_RECORDER, type StepRecorder } from '../../core/telemetry/index.js';
import { decodeText, fetchBounded, userAgentOf } from '../../core/transport/index.js';
import { DAYONE_MAX_BYTES, normalizeDayoneNumber, parseDayone, PROVIDER } from './parser.js';

/** The tracker's page for one parcel. */
export const DAYONE_PAGE = 'https://www.dayonetrack.com/track';
/** The lookup the page makes for a number with DOT0. */
export const DAYONE_API = 'https://www.dayonetrack.com/api/webservice/Service.ashx';
/** The JSONP callback the adapter names, as the page's jQuery does. */
export const DAYONE_CALLBACK = 'dayoneTrack';
const REDIRECTS = [301, 302, 303, 307, 308];
// Bot checks a CDN or a cloud firewall could put in place of the reply.
const CHALLENGE = /_cf_chl_opt|cf-turnstile|<title>\s*Just a moment|acw_sc__v2|aliyun_waf|_____tmd_____|waf\.tencent|<title>\s*(?:滑动验证|验证码|安全验证|访问受限|访问被拒绝)/i;
const JSONP = new RegExp(`^\\s*${DAYONE_CALLBACK}\\(([\\s\\S]*)\\)\\s*;?\\s*$`);

/** The page's request for one number: `param` the JSON of its query, `key` the Base64 of that text's MD5 in hexadecimal. */
export function dayoneLookupUrl(number: string): string {
  const param = JSON.stringify({ sp: '', nums: [number] });
  const key = Buffer.from(createHash('md5').update(param).digest('hex')).toString('base64');
  const query = new URLSearchParams({ callbackparam: DAYONE_CALLBACK, method: 'track', key, param });
  return `${DAYONE_API}?${query}`;
}

/** The reply's JSON, in the callback the request named or bare. */
function json(body: string): unknown {
  try {
    return JSON.parse(JSONP.exec(body)?.[1] ?? body);
  } catch (cause) {
    if (CHALLENGE.test(body.slice(0, 64_000))) throw new ChallengeError(PROVIDER, 'DayOne answered with a browser check', { cause });
    throw new SchemaError(PROVIDER, 'DayOne returned a reply that is not JSON', { cause });
  }
}

export class DayoneTracker {
  constructor(private readonly options: { fetcher?: typeof fetch; recorder?: StepRecorder; userAgent?: string } = {}) {}

  async fetch(raw: string, context: TrackingContext = {}): Promise<CarrierResult> {
    const number = normalizeDayoneNumber(raw);
    // The page sends DOT1 to DayOne's ERP, whose lookup answers an empty body, and no other number anywhere.
    if (!number.startsWith('DOT0')) throw new IndeterminateError(PROVIDER, 'DayOne’s tracker has no lookup the adapter reads for this number');
    const read = async (signal: AbortSignal, timeoutMs: number): Promise<CarrierResult> => {
      const { response, bytes } = await fetchBounded(dayoneLookupUrl(number), { method: 'GET', signal, headers: {
        Accept: 'text/javascript, application/javascript, */*; q=0.01', Referer: `${DAYONE_PAGE}?trackNo=${number}`,
        'User-Agent': userAgentOf(this.options.userAgent),
      } }, { provider: PROVIDER, timeoutMs: Math.max(1, Math.floor(timeoutMs)), maxBytes: DAYONE_MAX_BYTES,
        redirect: 'manual', fetcher: this.options.fetcher, allowHttpStatuses: [...REDIRECTS, 404, 410] });
      // The lookup answers every number with HTTP 200; a redirect or a 404 is a moved route.
      if (response.status !== 200) throw new TransportError(PROVIDER, 'DayOne tracking lookup moved', { status: response.status });
      return parseDayone(json(decodeText(bytes)), number);
    };
    // A read that fails to reach the site, or hangs, gets one more: the first gets half of the budget.
    return runSteps({ carrier: 'dayone', budgetMs: context.budgetMs ?? 15_000, signal: context.signal,
      recorder: this.options.recorder ?? NOOP_RECORDER }, [
      { id: 'direct', run: ({ signal, remainingMs }) => read(signal, firstAttemptMs(remainingMs)) },
      networkRetryStep(({ signal, remainingMs }) => read(signal, remainingMs)),
    ]);
  }
}

export const adapter: AdapterFactory = (environment) => {
  const tracker = new DayoneTracker({ fetcher: environment.fetcher, recorder: environment.recorder, userAgent: environment.userAgent });
  return { id: 'dayone', recordsSteps: true, steps: ['direct', 'retry'], track: (input, context) => tracker.fetch(input.number, context) };
};
