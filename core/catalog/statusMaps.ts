/**
 * The carriers' status maps, asked about one scan at a time.
 *
 * The parcel app keeps the wording no carrier map staged for review, keyed by
 * carrier, provider code and normalized wording. `statusMapAnswer` tells it
 * what the map of the scraper it runs says about such a key: the stage the map
 * gives it, a gap the map leaves on purpose, or nothing. A carrier declares its
 * `statusMap` next to its map in `status.ts`; carriers without one answer
 * `unknown`. The scans the app files under the carrier `unknown` come from the
 * universal providers, whose map is the reading they give a scan
 * (`providers/status.ts`).
 */
import { statusMap as acsCourier } from '../../carriers/acs-courier/status.js';
import { statusMap as aliexpress } from '../../carriers/aliexpress/status.js';
import { statusMap as allegroOne } from '../../carriers/allegro-one/status.js';
import { statusMap as anPost } from '../../carriers/an-post/status.js';
import { statusMap as apcOvernight } from '../../carriers/apc-overnight/status.js';
import { statusMap as arasKargo } from '../../carriers/aras-kargo/status.js';
import { statusMap as boxNow } from '../../carriers/box-now/status.js';
import { statusMap as cacesa } from '../../carriers/cacesa/status.js';
import { statusMap as cargus } from '../../carriers/cargus/status.js';
import { statusMap as cdek } from '../../carriers/cdek/status.js';
import { statusMap as cdl } from '../../carriers/cdl/status.js';
import { statusMap as ceskaPosta } from '../../carriers/ceska-posta/status.js';
import { statusMap as chinaPost } from '../../carriers/china-post/status.js';
import { statusMap as chitChats } from '../../carriers/chit-chats/status.js';
import { statusMap as chronopost } from '../../carriers/chronopost/status.js';
import { statusMap as correosSpain } from '../../carriers/correos-spain/status.js';
import { statusMap as cyprusPost } from '../../carriers/cyprus-post/status.js';
import { statusMap as dao } from '../../carriers/dao/status.js';
import { statusMap as dhlExpress } from '../../carriers/dhl-express/status.js';
import { statusMap as dpd } from '../../carriers/dpd/status.js';
import { statusMap as dpdDe } from '../../carriers/dpd-de/status.js';
import { statusMap as dpdFr } from '../../carriers/dpd-fr/status.js';
import { statusMap as dpdIe } from '../../carriers/dpd-ie/status.js';
import { statusMap as dpdPl } from '../../carriers/dpd-pl/status.js';
import { statusMap as dsv } from '../../carriers/dsv/status.js';
import { statusMap as dynalogic } from '../../carriers/dynalogic/status.js';
import { statusMap as earlyBird } from '../../carriers/early-bird/status.js';
import { statusMap as econt } from '../../carriers/econt/status.js';
import { statusMap as elta } from '../../carriers/elta/status.js';
import { statusMap as emile } from '../../carriers/emile/status.js';
import { statusMap as envialia } from '../../carriers/envialia/status.js';
import { statusMap as expressOne } from '../../carriers/express-one/status.js';
import { statusMap as fanCourier } from '../../carriers/fan-courier/status.js';
import { statusMap as foxpost } from '../../carriers/foxpost/status.js';
import { statusMap as gebruederWeiss } from '../../carriers/gebrueder-weiss/status.js';
import { statusMap as geis } from '../../carriers/geis/status.js';
import { statusMap as geniki } from '../../carriers/geniki-taxydromiki/status.js';
import { statusMap as glsEs } from '../../carriers/gls-es/status.js';
import { statusMap as glsIt } from '../../carriers/gls-it/status.js';
import { statusMap as goExpress } from '../../carriers/go-express/status.js';
import { statusMap as gofoFr } from '../../carriers/gofo-fr/status.js';
import { statusMap as gofoIt } from '../../carriers/gofo-it/status.js';
import { statusMap as helthjem } from '../../carriers/helthjem/status.js';
import { statusMap as hrvatskaPosta } from '../../carriers/hrvatska-posta/status.js';
import { statusMap as jAndT } from '../../carriers/j-and-t/status.js';
import { statusMap as jntCargo } from '../../carriers/j-and-t-cargo/status.js';
import { statusMap as jitsu } from '../../carriers/jitsu/status.js';
import { statusMap as kuehneNagel } from '../../carriers/kuehne-nagel/status.js';
import { statusMap as laPoste } from '../../carriers/la-poste/status.js';
import { statusMap as latvijasPasts } from '../../carriers/latvijas-pasts/status.js';
import { statusMap as lietuvosPastas } from '../../carriers/lietuvos-pastas/status.js';
import { statusMap as loomisExpress } from '../../carriers/loomis-express/status.js';
import { statusMap as maltapost } from '../../carriers/maltapost/status.js';
import { statusMap as matkahuolto } from '../../carriers/matkahuolto/status.js';
import { statusMap as meest } from '../../carriers/meest/status.js';
import { statusMap as mngKargo } from '../../carriers/mng-kargo/status.js';
import { statusMap as nationex } from '../../carriers/nationex/status.js';
import { statusMap as oldDominion } from '../../carriers/old-dominion/status.js';
import { statusMap as omgo } from '../../carriers/omgo/status.js';
import { statusMap as omniva } from '../../carriers/omniva/status.js';
import { statusMap as orlenPaczka } from '../../carriers/orlen-paczka/status.js';
import { statusMap as postLuxembourg } from '../../carriers/post-luxembourg/status.js';
import { statusMap as postaSlovenije } from '../../carriers/posta-slovenije/status.js';
import { statusMap as postaSrbije } from '../../carriers/posta-srbije/status.js';
import { statusMap as postlogistics } from '../../carriers/postlogistics/status.js';
import { statusMap as ppl } from '../../carriers/ppl/status.js';
import { statusMap as ptt } from '../../carriers/ptt/status.js';
import { statusMap as sagawa } from '../../carriers/sagawa/status.js';
import { statusMap as sameday } from '../../carriers/sameday/status.js';
import { statusMap as slovakParcelService } from '../../carriers/slovak-parcel-service/status.js';
import { statusMap as slovenskaPosta } from '../../carriers/slovenska-posta/status.js';
import { statusMap as speedx } from '../../carriers/speedx/status.js';
import { statusMap as speedy } from '../../carriers/speedy/status.js';
import { statusMap as stallionExpress } from '../../carriers/stallion-express/status.js';
import { statusMap as sto } from '../../carriers/sto/status.js';
import { statusMap as swissPost } from '../../carriers/swiss-post/status.js';
import { statusMap as thailandPost } from '../../carriers/thailand-post/status.js';
import { statusMap as tnt } from '../../carriers/tnt/status.js';
import { statusMap as ups } from '../../carriers/ups/status.js';
import { statusMap as venipak } from '../../carriers/venipak/status.js';
import { statusMap as vintedGo } from '../../carriers/vinted-go/status.js';
import { statusMap as whistl } from '../../carriers/whistl/status.js';
import { statusMap as xdp } from '../../carriers/xdp/status.js';
import { statusMap as yunexpress } from '../../carriers/yunexpress/status.js';
import { statusMap as yurticiKargo } from '../../carriers/yurtici-kargo/status.js';
import { statusMap as zeleris } from '../../carriers/zeleris/status.js';
import type { CarrierId, Stage } from '../../generated/catalog.js';
import { statusMap as universal } from '../../providers/status.js';
import { normalizeStatusWording, type CarrierStatusMap } from '../status/statusMap.js';
import { CARRIER_DEFINITIONS } from './definitions.js';

/** By adapter: a carrier served by another's adapter, as Delivengo by La Poste's, reads that map. */
export const STATUS_MAPS: Readonly<Record<string, CarrierStatusMap>> = {
  'acs-courier': acsCourier, aliexpress, 'allegro-one': allegroOne, 'an-post': anPost, 'apc-overnight': apcOvernight, 'aras-kargo': arasKargo,
  'box-now': boxNow, cacesa, cargus, cdek, cdl, 'ceska-posta': ceskaPosta, 'china-post': chinaPost, 'chit-chats': chitChats, chronopost, 'correos-spain': correosSpain,
  'cyprus-post': cyprusPost, dao, 'dhl-express': dhlExpress, dpd, 'dpd-de': dpdDe, 'dpd-fr': dpdFr, 'dpd-ie': dpdIe, 'dpd-pl': dpdPl, dsv,
  dynalogic, 'early-bird': earlyBird, econt, elta, emile, envialia, 'express-one': expressOne, 'fan-courier': fanCourier, foxpost,
  'gebrueder-weiss': gebruederWeiss, geis, 'geniki-taxydromiki': geniki, 'gls-es': glsEs, 'gls-it': glsIt, 'go-express': goExpress,
  'gofo-fr': gofoFr, 'gofo-it': gofoIt, helthjem, 'hrvatska-posta': hrvatskaPosta, 'j-and-t': jAndT, 'j-and-t-cargo': jntCargo, jitsu,
  'kuehne-nagel': kuehneNagel, 'la-poste': laPoste, 'latvijas-pasts': latvijasPasts, 'lietuvos-pastas': lietuvosPastas,
  'loomis-express': loomisExpress, maltapost, matkahuolto, meest, 'mng-kargo': mngKargo, nationex, 'old-dominion': oldDominion, omgo, omniva,
  'orlen-paczka': orlenPaczka, 'post-luxembourg': postLuxembourg, 'posta-slovenije': postaSlovenije, 'posta-srbije': postaSrbije, postlogistics, ppl,
  ptt, sagawa, sameday, 'slovak-parcel-service': slovakParcelService, 'slovenska-posta': slovenskaPosta, speedx, speedy,
  'stallion-express': stallionExpress, sto, 'swiss-post': swissPost, 'thailand-post': thailandPost, tnt, ups, venipak, 'vinted-go': vintedGo,
  whistl, xdp, yunexpress, 'yurtici-kargo': yurticiKargo, zeleris,
};

/** The carrier the app files the universal providers' scans under. */
const UNIVERSAL_CARRIER = 'unknown';

/** One scan as the app observed it. */
export interface ObservedStatus {
  /**
   * The catalog carrier that served the scan, the prefix of the app's provider
   * event id: `unknown` for a scan a universal provider relayed.
   */
  readonly carrier: string;
  readonly providerCode?: string | null;
  /** The scan's wording, as the carrier sent it or already normalized. */
  readonly description: string;
}

/**
 * What the carrier's map says about a scan: it gives the scan a stage, it
 * leaves it without one on purpose, or it does not know it.
 */
export type StatusMapAnswer =
  | { readonly kind: 'mapped'; readonly stage: Stage }
  | { readonly kind: 'intentional_gap'; readonly note: string }
  | { readonly kind: 'unknown' };

const UNKNOWN: StatusMapAnswer = { kind: 'unknown' };

function carrierStatusMap(carrier: string): CarrierStatusMap | undefined {
  if (carrier === UNIVERSAL_CARRIER) return universal;
  const adapter = Object.hasOwn(CARRIER_DEFINITIONS, carrier)
    ? CARRIER_DEFINITIONS[carrier as CarrierId].tracking.adapter
    : null;
  return adapter && Object.hasOwn(STATUS_MAPS, adapter) ? STATUS_MAPS[adapter] : undefined;
}

/**
 * What the carrier's map says about one observed scan, keyed as the app keys
 * its observations: carrier, provider code and `normalizeStatusWording`
 * wording. A gap without a code covers only wording that came without one; a
 * gap without wording covers every wording of its code. A scan a universal
 * provider relayed is `mapped` with the stage the providers' reading gives it,
 * as the sync does, and `unknown` when neither its code nor a rule stages it.
 */
export function statusMapAnswer(observed: ObservedStatus): StatusMapAnswer {
  const map = carrierStatusMap(observed.carrier);
  const wording = normalizeStatusWording(observed.description);
  if (!map || !wording) return UNKNOWN;
  const code = observed.providerCode || null;
  const stage = map.stage(code, wording);
  if (stage) return { kind: 'mapped', stage };
  const key = code === null ? null : map.codeKey?.(code) ?? code;
  const gap = map.gaps.find((candidate) => (candidate.code ?? null) === key
    && (candidate.wording === undefined || candidate.wording === wording));
  return gap ? { kind: 'intentional_gap', note: gap.note } : UNKNOWN;
}
