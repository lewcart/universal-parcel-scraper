import type { AdapterFactory, TrackingContext } from '../../core/adapter/index.js';
import { ChallengeError, SchemaError, TransportError } from '../../core/errors/index.js';
import type { CarrierResult } from '../../core/result/index.js';
import { runSteps } from '../../core/runner/index.js';
import { firstAttemptMs, networkRetryStep } from '../../core/runner/networkRetry.js';
import { NOOP_RECORDER, type StepRecorder } from '../../core/telemetry/index.js';
import { decodeText, fetchBounded, userAgentOf } from '../../core/transport/index.js';
import { CARRIER, normalizePortlessNumber, parsePortless, PORTLESS_MAX_BYTES, PROVIDER } from './parser.js';

/** The lookup Portless's tracking page is built on, on AfterShip's hosted tracking pages. */
export const PORTLESS_API = 'https://username.aftership.com/trpc/trackings.getTrackingWithTrackingNumber';
/** Portless's account on AfterShip, which every visitor's page names in its state. */
export const PORTLESS_ORGANIZATION = '4dc85ae2b97a43368fe53a935d5f6a63';
const REDIRECTS = [301, 302, 303, 307, 308];
// Bot checks a CDN or firewall could put in place of the reply.
const CHALLENGE = /_cf_chl_opt|cf-turnstile|<title>\s*(?:Just a moment|Attention Required|Access Denied)|captcha/i;
const DEFAULT_BUDGET_MS = 15_000;

/** The address of the lookup for one number, in English. */
export function portlessLookupUrl(number: string): string {
  const input = { organization_id: PORTLESS_ORGANIZATION, translate_to: 'en', tracking_number: number };
  return `${PORTLESS_API}?${new URLSearchParams({ input: JSON.stringify(input) })}`;
}

function json(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch (cause) {
    if (CHALLENGE.test(body.slice(0, 64_000))) throw new ChallengeError(PROVIDER, 'Portless answered with a browser check', { cause });
    throw new SchemaError(PROVIDER, 'Portless returned a reply that is not JSON', { cause });
  }
}

export class PortlessTracker {
  constructor(private readonly options: { fetcher?: typeof fetch; recorder?: StepRecorder; userAgent?: string } = {}) {}

  private async read(number: string, signal: AbortSignal, timeoutMs: number): Promise<CarrierResult> {
    const { response, bytes } = await fetchBounded(portlessLookupUrl(number), { method: 'GET', signal,
      headers: { Accept: 'application/json', 'User-Agent': userAgentOf(this.options.userAgent) },
    }, { provider: PROVIDER, timeoutMs: Math.max(1, Math.floor(timeoutMs)), maxBytes: PORTLESS_MAX_BYTES, redirect: 'manual',
      fetcher: this.options.fetcher, allowHttpStatuses: [...REDIRECTS, 404] });
    // A redirect or a missing route is a moved lookup, not a missing parcel: the
    // lookup answers a number it does not hold with HTTP 200.
    if (response.status !== 200) throw new TransportError(PROVIDER, 'Portless tracking lookup moved', { status: response.status });
    return parsePortless(json(decodeText(bytes)), number);
  }

  async fetch(raw: string, context: TrackingContext = {}): Promise<CarrierResult> {
    const number = normalizePortlessNumber(raw);
    // A read that fails to reach the lookup, or hangs, is sent once more: the first try gets half of the budget.
    return runSteps({ carrier: CARRIER, budgetMs: context.budgetMs ?? DEFAULT_BUDGET_MS, signal: context.signal,
      recorder: this.options.recorder ?? NOOP_RECORDER }, [
      { id: 'direct', run: ({ signal, remainingMs }) => this.read(number, signal, firstAttemptMs(remainingMs)) },
      networkRetryStep(({ signal, remainingMs }) => this.read(number, signal, remainingMs)),
    ]);
  }
}

export const adapter: AdapterFactory = (environment) => {
  const tracker = new PortlessTracker({ fetcher: environment.fetcher, recorder: environment.recorder, userAgent: environment.userAgent });
  return {
    id: CARRIER, recordsSteps: true, steps: ['direct', 'retry'],
    track: (input, context) => tracker.fetch(input.number, context),
  };
};
