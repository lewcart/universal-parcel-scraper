import { lookupBudget, type AdapterFactory, type TrackingContext } from '../../core/adapter/index.js';
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
  return { id: 'china-post', steps: ['direct'], track: (input, context) => tracker.fetch(input.number, context) };
};
