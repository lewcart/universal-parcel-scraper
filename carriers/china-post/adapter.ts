import { accepted, lookupBudget, recognizeFromLookup, type AdapterFactory, type TrackingContext } from '../../core/adapter/index.js';
import { carrierErrorKind } from '../../core/errors/index.js';
import type { CarrierResult } from '../../core/result/index.js';
import { userAgentOf } from '../../core/transport/index.js';
import { readChinaPostTraces } from './app.js';
import { normalizeChinaPostNumber, parseChinaPostTraces, PROVIDER } from './parser.js';

const BUDGET_MS = 15_000;

export class ChinaPostTracker {
  readonly #userAgent: string;

  constructor(private readonly options: { fetcher?: typeof fetch; userAgent?: string } = {}) {
    this.#userAgent = userAgentOf(options.userAgent);
  }

  async fetch(raw: string, context: TrackingContext = {}): Promise<CarrierResult> {
    const number = normalizeChinaPostNumber(raw);
    const budget = lookupBudget(context, BUDGET_MS, PROVIDER);
    const payload = await readChinaPostTraces(number, { fetcher: this.options.fetcher, userAgent: this.#userAgent,
      budget, callerSignal: context.signal });
    return parseChinaPostTraces(payload, number);
  }
}

export const adapter: AdapterFactory = (environment) => {
  const tracker = new ChinaPostTracker({ fetcher: environment.fetcher, userAgent: environment.userAgent });
  return {
    id: 'china-post',
    steps: ['direct'],
    track: (input, context) => tracker.fetch(input.number, context),
    recognize: async (number, context) => {
      try {
        return await recognizeFromLookup(() => tracker.fetch(number, context), () => accepted(() => normalizeChinaPostNumber(number)));
      } catch (error) {
        // The check step asks for a contact phone's digits only about an item China Post holds;
        // other numbers get its "no information" answer, which stays inconclusive.
        if (carrierErrorKind(error) === 'input_required') return { known: true, lastActivityAt: null };
        throw error;
      }
    },
  };
};
