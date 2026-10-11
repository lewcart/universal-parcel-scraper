import type { AdapterFactory, TrackingContext } from '../../core/adapter/index.js';
import { ChallengeError, SchemaError, TransportError } from '../../core/errors/index.js';
import type { CarrierResult } from '../../core/result/index.js';
import { runSteps } from '../../core/runner/index.js';
import { NOOP_RECORDER, type StepRecorder } from '../../core/telemetry/index.js';
import { decodeText, fetchBounded, userAgentOf } from '../../core/transport/index.js';
import { normalizePplNumber, parsePpl, parsePplRejection, PPL } from './parser.js';

const API = 'https://api.dhl.com/ecs/ppl/webapi/TrackAndTrace';
/** The key PPL's tracking page gives every visitor, included with the maintainer's approval. */
const KEY = '7HH634Q79Zpge4xEGeFAHXAnUMRxv0XQ';

function json(bytes: Uint8Array): unknown {
  const text = decodeText(bytes).replace(/^\uFEFF/, '');
  if (/^\s*</.test(text)) throw new ChallengeError(PPL, 'PPL answered with a web page');
  try { return JSON.parse(text); } catch (cause) { throw new SchemaError(PPL, 'PPL returned invalid tracking JSON', { cause }); }
}

export class PplTracker {
  constructor(private readonly options: {
    fetcher?: typeof fetch; recorder?: StepRecorder; userAgent?: string;
    /** The tracking page's key. Omit for the included one; null or blank turns the lookup off. */
    key?: string | null;
  } = {}) {}

  async fetch(raw: string, context: TrackingContext = {}): Promise<CarrierResult> {
    const number = normalizePplNumber(raw);
    const key = (this.options.key === undefined ? KEY : this.options.key ?? '').trim();
    if (!key) throw new ChallengeError(PPL, 'PPL tracking key is disabled');
    return runSteps({ carrier: 'ppl', budgetMs: context.budgetMs ?? 15_000, signal: context.signal,
      recorder: this.options.recorder ?? NOOP_RECORDER }, [{ id: 'direct', run: async ({ signal, remainingMs }) => {
      // The tracking page's own search: a POST with an empty body. English wording.
      const { response, bytes } = await fetchBounded(`${API}/${number}`, { method: 'POST', signal, headers: {
        Accept: 'application/json', 'Accept-Language': 'en-US', 'Content-Type': 'application/json', 'dhl-api-key': key,
        'User-Agent': userAgentOf(this.options.userAgent),
      }, body: '{}' }, { provider: PPL, timeoutMs: remainingMs, maxBytes: 1_000_000, fetcher: this.options.fetcher,
        allowHttpStatuses: [400, 404, 410] });
      if (response.status === 404 || response.status === 410) throw new TransportError(PPL, 'PPL tracking service is unavailable');
      const payload = json(bytes);
      return response.status === 400 ? parsePplRejection(payload, number) : parsePpl(payload, number);
    } }]);
  }
}

export const adapter: AdapterFactory = environment => {
  const tracker = new PplTracker({ fetcher: environment.fetcher, recorder: environment.recorder, userAgent: environment.userAgent,
    key: environment.env.PPL_TRACKING_KEY });
  return { id: 'ppl', recordsSteps: true, steps: ['direct'], track: (input, context) => tracker.fetch(input.number, context) };
};
