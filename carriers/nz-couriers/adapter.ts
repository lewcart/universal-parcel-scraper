import type { AdapterFactory, TrackingContext } from '../../core/adapter/index.js';
import { ChallengeError, InvalidInputError, NotFoundError, SchemaError, TransportError } from '../../core/errors/index.js';
import type { CarrierResult } from '../../core/result/index.js';
import { runSteps } from '../../core/runner/index.js';
import { NOOP_RECORDER, type StepRecorder } from '../../core/telemetry/index.js';
import { decodeText, fetchBounded, userAgentOf } from '../../core/transport/index.js';
import {
  freightwaysQueries, NEW_ZEALAND_COURIERS, NZ_COURIERS_MAX_BYTES, parseFreightways, type FreightwaysNetwork, type FreightwaysQuery, type NzCouriersQuery,
} from './parser.js';

/** The Freightways group's tracking lookup for one of its networks. */
export function freightwaysApi(network: FreightwaysNetwork): string {
  return `https://public-website.ep-prod.freightways.co.nz/public-website/v1/carriers/${network.path}/tracking-events`;
}

/** The lookup the tracking page on nzcouriers.co.nz makes for the number in its address. */
export const NZ_COURIERS_API = freightwaysApi(NEW_ZEALAND_COURIERS);
const REDIRECTS = [301, 302, 303, 307, 308];
const VALIDATION = /"title"\s*:\s*"REQUEST_VALIDATION_ERROR"/;
// Bot checks CloudFront or a firewall could put in place of the reply.
const CHALLENGE = /_cf_chl_opt|cf-turnstile|<title>\s*Just a moment|AwsWafIntegration|awswaf\.com|gokuProps|Request blocked/i;

/** The address of a network's lookup: a ticket as its product code and number, a label or consignment number alone. */
export function freightwaysLookupUrl(network: FreightwaysNetwork, asked: FreightwaysQuery): string {
  const params = asked.kind === 'ticket'
    ? new URLSearchParams({ searchType: 'TK', ticketProductCode: asked.code, query: asked.query })
    : new URLSearchParams({ query: asked.query });
  return `${freightwaysApi(network)}?${params}`;
}

/** The address of New Zealand Couriers' lookup for one number. */
export function nzCouriersLookupUrl(asked: NzCouriersQuery): string {
  return freightwaysLookupUrl(NEW_ZEALAND_COURIERS, asked);
}

function json(provider: string, body: string): unknown {
  try {
    return JSON.parse(body);
  } catch (cause) {
    if (CHALLENGE.test(body.slice(0, 64_000))) throw new ChallengeError(provider, `${provider} answered with a browser check`, { cause });
    throw new SchemaError(provider, `${provider} returned a reply that is not JSON`, { cause });
  }
}

/**
 * The group's tracker for one Freightways network. Post Haste's adapter uses it
 * with its own network. A number that fits both a ticket and a customer printed
 * label's consignment number is asked as the ticket first, then whole when the
 * lookup does not hold the ticket.
 */
export class FreightwaysTracker {
  constructor(private readonly network: FreightwaysNetwork,
    private readonly options: { fetcher?: typeof fetch; recorder?: StepRecorder; userAgent?: string } = {}) {}

  async fetch(raw: string, context: TrackingContext = {}): Promise<CarrierResult> {
    const { network } = this;
    const { provider } = network;
    const queries = freightwaysQueries(network, raw);
    /** One lookup's consignment, or null when the lookup does not hold the number. */
    const lookup = async (asked: FreightwaysQuery, signal: AbortSignal, timeoutMs: number): Promise<CarrierResult | null> => {
      const { response, bytes } = await fetchBounded(freightwaysLookupUrl(network, asked), { signal, headers: {
        Accept: 'application/json', 'User-Agent': userAgentOf(this.options.userAgent),
      } }, { provider, timeoutMs: Math.max(1, Math.floor(timeoutMs)), maxBytes: NZ_COURIERS_MAX_BYTES,
        redirect: 'manual', fetcher: this.options.fetcher, allowHttpStatuses: [...REDIRECTS, 400, 404, 410] });
      if (REDIRECTS.includes(response.status)) throw new TransportError(provider, `${provider} redirected its tracking lookup`);
      // The page reads a missing parcel from an empty 204 reply; a 404 is a moved route.
      if (response.status === 404 || response.status === 410) throw new TransportError(provider, `${provider} tracking lookup is unavailable`);
      if (response.status === 400) {
        // The lookup's own refusal of a query it does not take, such as one too short.
        if (VALIDATION.test(decodeText(bytes).slice(0, 4_000))) throw new InvalidInputError(provider, `${provider} refused the number`);
        throw new TransportError(provider, `${provider} rejected the tracking lookup`, { status: 400 });
      }
      if (response.status === 204) return null;
      return parseFreightways(network, json(provider, decodeText(bytes)), asked.number);
    };
    const read = async (signal: AbortSignal, remainingMs: number): Promise<CarrierResult> => {
      const deadline = Date.now() + remainingMs;
      for (const asked of queries) {
        const result = await lookup(asked, signal, deadline - Date.now());
        if (result) return result;
      }
      throw new NotFoundError(provider);
    };
    return runSteps({ carrier: network.carrier, budgetMs: context.budgetMs ?? 20_000, signal: context.signal,
      recorder: this.options.recorder ?? NOOP_RECORDER }, [
      { id: 'direct', run: ({ signal, remainingMs }) => read(signal, remainingMs) },
    ]);
  }
}

export class NzCouriersTracker extends FreightwaysTracker {
  constructor(options: ConstructorParameters<typeof FreightwaysTracker>[1] = {}) { super(NEW_ZEALAND_COURIERS, options); }
}

export const adapter: AdapterFactory = (environment) => {
  const tracker = new NzCouriersTracker({ fetcher: environment.fetcher, recorder: environment.recorder, userAgent: environment.userAgent });
  return {
    id: 'nz-couriers', recordsSteps: true, steps: ['direct'],
    track: (input, context) => tracker.fetch(input.number, context),
  };
};
