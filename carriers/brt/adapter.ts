import { accepted, recognizeFromLookup, type AdapterFactory, type TrackingContext } from '../../core/adapter/index.js';
import { BudgetExceededError, IndeterminateError, SchemaError } from '../../core/errors/index.js';
import type { CarrierResult } from '../../core/result/index.js';
import { runSteps } from '../../core/runner/index.js';
import { NOOP_RECORDER, type StepRecorder } from '../../core/telemetry/index.js';
import { decodeText, fetchBounded, userAgentOf } from '../../core/transport/index.js';
import { ChronopostTracker } from '../chronopost/adapter.js';
import { DPDTracker } from '../dpd/adapter.js';
import { brtOriginPartner, brtParcelListPath, normalizeBrtNumber, parseBrt, stagedDpdLeg, withOriginLeg, type BrtOriginPartner } from './parser.js';

const BASE = 'https://vas.brt.it/vas/';
/** The time kept for BRT's own answer when a partner's lookup runs out. */
const ORIGIN_RESERVE_MS = 500;

/** A partner's lookup of the number BRT tracks a parcel under. */
export type BrtOriginLookup = (number: string, context: TrackingContext) => Promise<CarrierResult>;

export class BrtTracker {
  constructor(private readonly options: { fetcher?: typeof fetch; recorder?: StepRecorder; userAgent?: string;
    /** The lookups of partners that bring parcels from abroad, by the BRTcode they share. */
    origins?: Partial<Record<BrtOriginPartner, BrtOriginLookup>> } = {}) {}

  fetch(raw: string, context: TrackingContext = {}) {
    const number = normalizeBrtNumber(raw);
    const budgetMs = context.budgetMs ?? 15_000;
    return runSteps({ carrier: 'brt', budgetMs, signal: context.signal,
      recorder: this.options.recorder ?? NOOP_RECORDER }, [{ id: 'direct', run: async ({ signal, remainingMs }) => {
      signal.throwIfAborted();
      const deadline = performance.now() + remainingMs;
      const page = async (url: string, form?: Record<string, string>): Promise<string> => {
        const left = deadline - performance.now();
        if (left <= 0) throw new BudgetExceededError('BRT', budgetMs);
        const { response, bytes } = await fetchBounded(url,
          { signal, headers: { 'User-Agent': userAgentOf(this.options.userAgent), ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
            ...(form ? { method: 'POST', body: new URLSearchParams(form).toString() } : {}) },
          { provider: 'BRT', timeoutMs: Math.max(1, Math.floor(left)), maxBytes: 1_000_000,
            redirect: 'manual', allowHttpStatuses: [302, 404, 410], fetcher: this.options.fetcher });
        if (performance.now() >= deadline) throw new BudgetExceededError('BRT', budgetMs);
        signal.throwIfAborted();
        if (response.status !== 200) throw new IndeterminateError('BRT', 'BRT tracking endpoint is unavailable');
        const charset = /charset\s*=\s*["']?([A-Za-z0-9_-]+)/i.exec(response.headers.get('content-type') ?? '')?.[1]!.toLowerCase();
        if (charset && !['utf-8', 'utf8', 'iso-8859-1', 'windows-1252'].includes(charset)) throw new SchemaError('BRT', 'BRT response encoding changed');
        return decodeText(bytes, charset?.startsWith('utf') ? 'utf-8' : 'windows-1252');
      };
      if (number.length === 14) {
        const result = parseBrt(await page(`${BASE}sped_det_new.htm?brtCode=${number}&lang=en`), number);
        const partner = brtOriginPartner(result);
        const lookup = partner && this.options.origins?.[partner];
        const budget = Math.floor(deadline - performance.now() - ORIGIN_RESERVE_MS);
        if (!lookup || budget <= 0) return result;
        // The partner's leg adds to BRT's answer, which stands without it.
        const leg = await lookup(number, { signal, budgetMs: budget }).catch(() => {
          context.signal?.throwIfAborted();
          return null;
        });
        return leg ? withOriginLeg(result, leg) : result;
      }
      if (number.length === 12) {
        return parseBrt(await page(`${BASE}sped_det_show.hsm?lang=en`,
          { Nspediz: number, referer: 'sped_numspe_par.htm', RicercaNumeroSpedizione: 'Ricerca', lang: 'en' }), number);
      }
      // A parcel ID goes through the form's customer parcel ID search. Its
      // result does not repeat the ID, so the shipment's parcel list must name it.
      const detail = await page(`${BASE}sped_det_show.hsm?lang=en`, { referer: 'sped_numspe_par.htm', ChiSono: number,
        ClienteMittente: '', DataInizio: '', DataFine: '', RicercaChiSono: 'Ricerca', lang: 'en' });
      return parseBrt(detail, number, await page(new URL(brtParcelListPath(detail, number), BASE).href));
    } }]);
  }
}

export const adapter: AdapterFactory = environment => {
  const transport = { fetcher: environment.fetcher, userAgent: environment.userAgent };
  const chronopost = new ChronopostTracker(transport);
  // DPD's guest service answers for the whole group; Belgium's unit asks it alone.
  const dpd = new DPDTracker({ ...transport, country: 'BE' });
  const tracker = new BrtTracker({ ...transport, recorder: environment.recorder });
  // Recognition reads BRT alone.
  const tracking = new BrtTracker({ ...transport, recorder: environment.recorder, origins: {
    chronopost: (number, context) => chronopost.fetch(number, context),
    dpd: (number, context) => dpd.fetch(number, '', context).then(stagedDpdLeg),
  } });
  return { id: 'brt', recordsSteps: true, steps: ['direct'], track: (input, context) => tracking.fetch(input.number, context),
    recognize: (number, context) => recognizeFromLookup(() => tracker.fetch(number, context), () => accepted(() => normalizeBrtNumber(number))) };
};
