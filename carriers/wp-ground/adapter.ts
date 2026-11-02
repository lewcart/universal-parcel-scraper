import type { AdapterFactory, TrackingContext } from '../../core/adapter/index.js';
import { ChallengeError, SchemaError, TransportError } from '../../core/errors/index.js';
import type { CarrierResult } from '../../core/result/index.js';
import { runSteps } from '../../core/runner/index.js';
import { NOOP_RECORDER, type StepRecorder } from '../../core/telemetry/index.js';
import { decodeText, fetchBounded, parseJsonBytes, userAgentOf } from '../../core/transport/index.js';
import { parseWpGround, PROVIDER, wpGroundNumber } from './parser.js';

export const WP_GROUND_ENDPOINT = 'https://www.wpglogis.com/api/trackQuery';

export class WpGroundTracker {
  constructor(private readonly options: { fetcher?: typeof fetch; recorder?: StepRecorder; userAgent?: string } = {}) {}

  async fetch(raw: string, context: TrackingContext = {}): Promise<CarrierResult> {
    const number = wpGroundNumber(raw);
    return runSteps({ carrier: 'wp-ground', budgetMs: context.budgetMs ?? 15_000, signal: context.signal,
      recorder: this.options.recorder ?? NOOP_RECORDER }, [{ id: 'direct', run: async ({ signal, remainingMs }) => {
      const { response, bytes } = await fetchBounded(WP_GROUND_ENDPOINT, {
        method: 'POST', signal, body: new URLSearchParams({ trackNumberList: number }).toString(),
        headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded',
          Origin: 'https://www.wpglogis.com', Referer: 'https://www.wpglogis.com/tracking/', 'User-Agent': userAgentOf(this.options.userAgent) },
      }, { provider: PROVIDER, timeoutMs: remainingMs, fetcher: this.options.fetcher, maxBytes: 1_000_000, allowHttpStatuses: [404, 410] });
      if ([404, 410].includes(response.status)) throw new TransportError(PROVIDER, 'WP Ground tracking endpoint is unavailable');
      let payload: unknown;
      try { payload = parseJsonBytes(bytes, PROVIDER); }
      catch (cause) {
        if (/<title>\s*(?:Just a moment|Attention Required|Access Denied)|_cf_chl_opt/i.test(decodeText(bytes.subarray(0, 64_000)))) {
          throw new ChallengeError(PROVIDER, 'WP Ground answered with a block page', { cause });
        }
        throw new SchemaError(PROVIDER, 'WP Ground returned invalid tracking JSON', { cause });
      }
      return parseWpGround(payload, number);
    } }]);
  }
}

export const adapter: AdapterFactory = environment => {
  const tracker = new WpGroundTracker({ fetcher: environment.fetcher, recorder: environment.recorder, userAgent: environment.userAgent });
  return { id: 'wp-ground', recordsSteps: true, steps: ['direct'], track: (input, context) => tracker.fetch(input.number, context) };
};
