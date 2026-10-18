import type { AdapterFactory, TrackingContext } from '../../core/adapter/index.js';
import { ChallengeError, InvalidInputError, NotFoundError, SchemaError, TransportError } from '../../core/errors/index.js';
import type { CarrierResult } from '../../core/result/index.js';
import { runSteps } from '../../core/runner/index.js';
import { NOOP_RECORDER, type StepRecorder } from '../../core/telemetry/index.js';
import { decodeText, fetchBounded, userAgentOf } from '../../core/transport/index.js';
import { NZ_COURIERS_MAX_BYTES, nzCouriersQuery, parseNzCouriers, PROVIDER, type NzCouriersQuery } from './parser.js';

/** The lookup the tracking page on nzcouriers.co.nz makes for the number in its address. */
export const NZ_COURIERS_API = 'https://public-website.ep-prod.freightways.co.nz/public-website/v1/carriers/NZCouriers/tracking-events';
const REDIRECTS = [301, 302, 303, 307, 308];
const VALIDATION = /"title"\s*:\s*"REQUEST_VALIDATION_ERROR"/;
// Bot checks CloudFront or a firewall could put in place of the reply.
const CHALLENGE = /_cf_chl_opt|cf-turnstile|<title>\s*Just a moment|AwsWafIntegration|awswaf\.com|gokuProps|Request blocked/i;

/** The address of the lookup: a ticket as its product code and number, a label alone. */
export function nzCouriersLookupUrl(asked: NzCouriersQuery): string {
  const params = asked.kind === 'ticket'
    ? new URLSearchParams({ searchType: 'TK', ticketProductCode: asked.code, query: asked.query })
    : new URLSearchParams({ query: asked.query });
  return `${NZ_COURIERS_API}?${params}`;
}

function json(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch (cause) {
    if (CHALLENGE.test(body.slice(0, 64_000))) throw new ChallengeError(PROVIDER, 'New Zealand Couriers answered with a browser check', { cause });
    throw new SchemaError(PROVIDER, 'New Zealand Couriers returned a reply that is not JSON', { cause });
  }
}

export class NzCouriersTracker {
  constructor(private readonly options: { fetcher?: typeof fetch; recorder?: StepRecorder; userAgent?: string } = {}) {}

  async fetch(raw: string, context: TrackingContext = {}): Promise<CarrierResult> {
    const asked = nzCouriersQuery(raw);
    const read = async (signal: AbortSignal, timeoutMs: number): Promise<CarrierResult> => {
      const { response, bytes } = await fetchBounded(nzCouriersLookupUrl(asked), { signal, headers: {
        Accept: 'application/json', 'User-Agent': userAgentOf(this.options.userAgent),
      } }, { provider: PROVIDER, timeoutMs: Math.max(1, Math.floor(timeoutMs)), maxBytes: NZ_COURIERS_MAX_BYTES,
        redirect: 'manual', fetcher: this.options.fetcher, allowHttpStatuses: [...REDIRECTS, 400, 404, 410] });
      if (REDIRECTS.includes(response.status)) throw new TransportError(PROVIDER, 'New Zealand Couriers redirected its tracking lookup');
      // The page reads a missing parcel from an empty 204 reply; a 404 is a moved route.
      if (response.status === 404 || response.status === 410) throw new TransportError(PROVIDER, 'New Zealand Couriers tracking lookup is unavailable');
      if (response.status === 400) {
        // The lookup's own refusal of a query it does not take, such as one too short.
        if (VALIDATION.test(decodeText(bytes).slice(0, 4_000))) throw new InvalidInputError(PROVIDER, 'New Zealand Couriers refused the number');
        throw new TransportError(PROVIDER, 'New Zealand Couriers rejected the tracking lookup', { status: 400 });
      }
      if (response.status === 204) throw new NotFoundError(PROVIDER);
      return parseNzCouriers(json(decodeText(bytes)), asked.number);
    };
    return runSteps({ carrier: 'nz-couriers', budgetMs: context.budgetMs ?? 20_000, signal: context.signal,
      recorder: this.options.recorder ?? NOOP_RECORDER }, [
      { id: 'direct', run: ({ signal, remainingMs }) => read(signal, remainingMs) },
    ]);
  }
}

export const adapter: AdapterFactory = (environment) => {
  const tracker = new NzCouriersTracker({ fetcher: environment.fetcher, recorder: environment.recorder, userAgent: environment.userAgent });
  return {
    id: 'nz-couriers', recordsSteps: true, steps: ['direct'],
    track: (input, context) => tracker.fetch(input.number, context),
  };
};
