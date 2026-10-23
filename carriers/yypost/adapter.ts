import { createHash } from 'node:crypto';
import type { AdapterFactory, TrackingContext } from '../../core/adapter/index.js';
import { ChallengeError, SchemaError, TransportError } from '../../core/errors/index.js';
import type { CarrierResult } from '../../core/result/index.js';
import { runSteps } from '../../core/runner/index.js';
import { firstAttemptMs, networkRetryStep } from '../../core/runner/networkRetry.js';
import { NOOP_RECORDER, type StepRecorder } from '../../core/telemetry/index.js';
import { decodeText, fetchBounded, userAgentOf } from '../../core/transport/index.js';
import { normalizeYypostNumber, parseYypost, PROVIDER, YYPOST_MAX_BYTES } from './parser.js';

/** The tracking page, which opens the parcel from its `c` parameter. */
export const YYPOST_PAGE = 'http://www.yypostal.com/track.html';
/** The lookup the page makes on YYpost's tenant of its tracking platform, which answers plain HTTP only. */
export const YYPOST_API = 'http://szyy.rtb56.com/webservice/Service.ashx';
/** The JSONP callback the adapter names, as the page's jQuery does. */
export const YYPOST_CALLBACK = 'yypostTrack';
const REDIRECTS = [301, 302, 303, 307, 308];
// Bot checks a CDN or a cloud firewall could put in place of the reply.
const CHALLENGE = /_cf_chl_opt|cf-turnstile|<title>\s*Just a moment|acw_sc__v2|aliyun_waf|_____tmd_____|waf\.tencent|<title>\s*(?:滑动验证|验证码|安全验证|访问受限|访问被拒绝)/i;
const JSONP = new RegExp(`^\\s*${YYPOST_CALLBACK}\\(([\\s\\S]*)\\)\\s*;?\\s*$`);

/** The page's request for one number: `param` the JSON of its query, `key` the Base64 of that text's MD5 in hexadecimal. */
export function yypostLookupUrl(number: string): string {
  const param = JSON.stringify({ sp: '', nums: [number] });
  const key = Buffer.from(createHash('md5').update(param).digest('hex')).toString('base64');
  const query = new URLSearchParams({ callbackparam: YYPOST_CALLBACK, method: 'track', key, param });
  return `${YYPOST_API}?${query}`;
}

/** The reply's JSON, in the callback the request named or bare. */
function json(body: string): unknown {
  try {
    return JSON.parse(JSONP.exec(body)?.[1] ?? body);
  } catch (cause) {
    if (CHALLENGE.test(body.slice(0, 64_000))) throw new ChallengeError(PROVIDER, 'YYpost answered with a browser check', { cause });
    throw new SchemaError(PROVIDER, 'YYpost returned a reply that is not JSON', { cause });
  }
}

export class YypostTracker {
  constructor(private readonly options: { fetcher?: typeof fetch; recorder?: StepRecorder; userAgent?: string } = {}) {}

  async fetch(raw: string, context: TrackingContext = {}): Promise<CarrierResult> {
    const number = normalizeYypostNumber(raw);
    const read = async (signal: AbortSignal, timeoutMs: number): Promise<CarrierResult> => {
      const { response, bytes } = await fetchBounded(yypostLookupUrl(number), { method: 'GET', signal, headers: {
        Accept: 'text/javascript, application/javascript, */*; q=0.01', Referer: `${YYPOST_PAGE}?c=${number}`,
        'User-Agent': userAgentOf(this.options.userAgent),
      } }, { provider: PROVIDER, timeoutMs: Math.max(1, Math.floor(timeoutMs)), maxBytes: YYPOST_MAX_BYTES,
        redirect: 'manual', fetcher: this.options.fetcher, allowHttpStatuses: [...REDIRECTS, 404, 410] });
      // The lookup answers every number with HTTP 200; a redirect or a 404 is a moved route.
      if (response.status !== 200) throw new TransportError(PROVIDER, 'YYpost tracking lookup moved', { status: response.status });
      return parseYypost(json(decodeText(bytes)), number);
    };
    // A read that fails to reach the site, or hangs, gets one more: the first gets half of the budget.
    return runSteps({ carrier: 'yypost', budgetMs: context.budgetMs ?? 15_000, signal: context.signal,
      recorder: this.options.recorder ?? NOOP_RECORDER }, [
      { id: 'direct', run: ({ signal, remainingMs }) => read(signal, firstAttemptMs(remainingMs)) },
      networkRetryStep(({ signal, remainingMs }) => read(signal, remainingMs)),
    ]);
  }
}

export const adapter: AdapterFactory = (environment) => {
  const tracker = new YypostTracker({ fetcher: environment.fetcher, recorder: environment.recorder, userAgent: environment.userAgent });
  return { id: 'yypost', recordsSteps: true, steps: ['direct', 'retry'], track: (input, context) => tracker.fetch(input.number, context) };
};
