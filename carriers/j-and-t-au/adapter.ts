import { createHash } from 'node:crypto';
import { accepted, recognizeFromLookup, type AdapterFactory, type TrackingContext } from '../../core/adapter/index.js';
import { ChallengeError, SchemaError, TransportError } from '../../core/errors/index.js';
import type { CarrierResult } from '../../core/result/index.js';
import { runSteps } from '../../core/runner/index.js';
import { firstAttemptMs, networkRetryStep } from '../../core/runner/networkRetry.js';
import { NOOP_RECORDER, type StepRecorder } from '../../core/telemetry/index.js';
import { decodeText, fetchBounded, userAgentOf } from '../../core/transport/index.js';
import { J_AND_T_AU_MAX_BYTES, normalizeJAndTAuNumber, parseJAndTAu, PROVIDER } from './parser.js';

/** The lookup the tracking page on www.jtexpress.au makes for the waybills typed in. */
export const J_AND_T_AU_API = 'https://official.jtaunz.com/official/logisticsTracking/getDetailByWaybillNo?countryCode=AU';
/** The app id and signing key the site's script gives every visitor; the page sends the key along as a header too. */
export const J_AND_T_AU_APP_ID = '2BZWAROTK578H7MG9YPWT057NN6IN8T1'; // gitleaks:allow
export const J_AND_T_AU_SIGNING_KEY = 'cteezp48358yyn6t6l9w8wfz2wctuqs7'; // gitleaks:allow
const REDIRECTS = [301, 302, 303, 307, 308];
// Bot checks a CDN or firewall could put in place of the reply.
const CHALLENGE = /_cf_chl_opt|cf-turnstile|<title>\s*Just a moment|acw_sc__v2|aliyun_waf|_____tmd_____|AwsWafIntegration|awswaf\.com/i;

/**
 * The page's signature of a request: MD5, in capitals, of the app id, the
 * timestamp, the nonce, the JSON body with its keys sorted and the key.
 */
export function jAndTAuSignature(timestamp: string, nonce: string, sortedBody: string): string {
  return createHash('md5').update(`${J_AND_T_AU_APP_ID}${timestamp}${nonce}${sortedBody}${J_AND_T_AU_SIGNING_KEY}`).digest('hex').toUpperCase();
}

/** The zone the request names, which the reply writes every scan time in: UTC, so each is an instant. */
export const J_AND_T_AU_ZONE = 'GMT+0000';

/** The page's request for one waybill: its body, and its headers signed over the same fields with their keys sorted. */
export function jAndTAuRequest(number: string): { body: string; headers: Record<string, string> } {
  const timestamp = String(Date.now());
  const nonce = String(Math.random());
  return {
    body: JSON.stringify({ waybillNos: [number], langType: 'EN' }),
    headers: {
      langType: 'EN', appId: J_AND_T_AU_APP_ID, timestamp, nonce, countryCode: 'AU', key: J_AND_T_AU_SIGNING_KEY,
      sign: jAndTAuSignature(timestamp, nonce, JSON.stringify({ langType: 'EN', waybillNos: [number] })),
      timezone: J_AND_T_AU_ZONE,
    },
  };
}

function json(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch (cause) {
    // A JSON lookup answering with a page has been turned away.
    if (CHALLENGE.test(body.slice(0, 64_000)) || /^\s*</.test(body)) {
      throw new ChallengeError(PROVIDER, 'J&T Express Australia answered with a page instead of its lookup', { cause });
    }
    throw new SchemaError(PROVIDER, 'J&T Express Australia returned a reply that is not JSON', { cause });
  }
}

export class JAndTAuTracker {
  constructor(private readonly options: { fetcher?: typeof fetch; recorder?: StepRecorder; userAgent?: string } = {}) {}

  async fetch(raw: string, context: TrackingContext = {}): Promise<CarrierResult> {
    const number = normalizeJAndTAuNumber(raw);
    const read = async (signal: AbortSignal, timeoutMs: number): Promise<CarrierResult> => {
      // Signed afresh for each try, as the page signs each request.
      const { body, headers } = jAndTAuRequest(number);
      const { response, bytes } = await fetchBounded(J_AND_T_AU_API, { method: 'POST', signal, headers: {
        Accept: 'application/json, text/plain, */*', 'Content-Type': 'application/json', 'User-Agent': userAgentOf(this.options.userAgent),
        ...headers,
      }, body }, { provider: PROVIDER, timeoutMs: Math.max(1, Math.floor(timeoutMs)), maxBytes: J_AND_T_AU_MAX_BYTES,
        redirect: 'manual', fetcher: this.options.fetcher, allowHttpStatuses: [...REDIRECTS, 404, 410] });
      if (REDIRECTS.includes(response.status)) throw new TransportError(PROVIDER, 'J&T Express Australia redirected its tracking lookup');
      // The lookup answers every waybill with HTTP 200; a 404 is a moved route, not an unknown parcel.
      if (response.status === 404 || response.status === 410) throw new TransportError(PROVIDER, 'J&T Express Australia tracking lookup is unavailable');
      return parseJAndTAu(json(decodeText(bytes)), number);
    };
    // A request that fails to reach the site, or hangs, gets one more try: the
    // first gets half of the budget, so the retry fits in the rest.
    return runSteps({ carrier: 'j-and-t-au', budgetMs: context.budgetMs ?? 15_000, signal: context.signal,
      recorder: this.options.recorder ?? NOOP_RECORDER }, [
      { id: 'direct', run: ({ signal, remainingMs }) => read(signal, firstAttemptMs(remainingMs)) },
      networkRetryStep(({ signal, remainingMs }) => read(signal, remainingMs)),
    ]);
  }
}

export const adapter: AdapterFactory = (environment) => {
  const tracker = new JAndTAuTracker({ fetcher: environment.fetcher, recorder: environment.recorder, userAgent: environment.userAgent });
  return {
    id: 'j-and-t-au', recordsSteps: true, steps: ['direct', 'retry'],
    track: (input, context) => tracker.fetch(input.number, context),
    recognize: (number, context) => recognizeFromLookup(() => tracker.fetch(number, context),
      () => accepted(() => normalizeJAndTAuNumber(number))),
  };
};
