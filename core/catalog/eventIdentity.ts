import { sameInstantIdentityPolicy as aliexpress } from '../../carriers/aliexpress/app.js';
import { sameInstantIdentityPolicy as amazonShipping } from '../../carriers/amazon-shipping/app.js';
import { sameInstantIdentityPolicy as australiaPost } from '../../carriers/australia-post/app.js';
import { sameInstantIdentityPolicy as austrianPost } from '../../carriers/austrian-post/identity.js';
import { sameInstantIdentityPolicy as canadaPost } from '../../carriers/canada-post/app.js';
import { sameInstantIdentityPolicy as chronopost } from '../../carriers/chronopost/identity.js';
import { sameInstantIdentityPolicy as ciblex } from '../../carriers/ciblex/identity.js';
import { sameInstantIdentityPolicy as correosExpress } from '../../carriers/correos-express/identity.js';
import { sameInstantIdentityPolicy as correosSpain } from '../../carriers/correos-spain/identity.js';
import { sameInstantIdentityPolicy as ctt } from '../../carriers/ctt/app.js';
import { sameInstantIdentityPolicy as cttyex } from '../../carriers/cttyex/identity.js';
import { sameInstantIdentityPolicy as dhlEcommerce } from '../../carriers/dhl-ecommerce/identity.js';
import { sameInstantIdentityPolicy as dhlExpress } from '../../carriers/dhl-express/identity.js';
import { sameInstantIdentityPolicy as dpd } from '../../carriers/dpd/app.js';
import { sameInstantIdentityPolicy as dpdFrance } from '../../carriers/dpd-fr/identity.js';
import { sameInstantIdentityPolicy as fedex } from '../../carriers/fedex/identity.js';
import { sameInstantIdentityPolicy as hermesGermany } from '../../carriers/hermes-de/identity.js';
import { sameInstantIdentityPolicy as indiaPost } from '../../carriers/india-post/app.js';
import { sameInstantIdentityPolicy as inpost } from '../../carriers/inpost/identity.js';
import { sameInstantIdentityPolicy as jdLogistics } from '../../carriers/jd-logistics/identity.js';
import { sameInstantIdentityPolicy as jrt } from '../../carriers/jrt/identity.js';
import { sameInstantIdentityPolicy as laPoste } from '../../carriers/la-poste/identity.js';
import { sameInstantIdentityPolicy as lbcExpress } from '../../carriers/lbc-express/identity.js';
import { sameInstantIdentityPolicy as linhan } from '../../carriers/linhan/identity.js';
import { sameInstantIdentityPolicy as mondialRelay } from '../../carriers/mondial-relay/identity.js';
import { sameInstantIdentityPolicy as mrw } from '../../carriers/mrw/identity.js';
import { sameInstantIdentityPolicy as nzPost } from '../../carriers/nz-post/identity.js';
import { sameInstantIdentityPolicy as packeta } from '../../carriers/packeta/identity.js';
import { sameInstantIdentityPolicy as posMalaysia } from '../../carriers/pos-malaysia/identity.js';
import { sameInstantIdentityPolicy as postnord } from '../../carriers/postnord/identity.js';
import { sameInstantIdentityPolicy as postlogistics } from '../../carriers/postlogistics/identity.js';
import { sameInstantIdentityPolicy as postaSlovenije } from '../../carriers/posta-slovenije/identity.js';
import { sameInstantIdentityPolicy as posteItaliane } from '../../carriers/poste-italiane/identity.js';
import { sameInstantIdentityPolicy as posti } from '../../carriers/posti/identity.js';
import { parcelforceIdentityPolicy as parcelforce, sameInstantIdentityPolicy as royalMail } from '../../carriers/royal-mail/identity.js';
import { sameInstantIdentityPolicy as sfExpress } from '../../carriers/sf-express/identity.js';
import { sameInstantIdentityPolicy as speedpak } from '../../carriers/speedpak/identity.js';
import { sameInstantIdentityPolicy as sunYou } from '../../carriers/sunyou/identity.js';
import { sameInstantIdentityPolicy as thhy } from '../../carriers/thhy/identity.js';
import { sameInstantIdentityPolicy as ups } from '../../carriers/ups/app.js';
import { sameInstantIdentityPolicy as swissPost } from '../../carriers/swiss-post/app.js';
import { sameInstantIdentityPolicy as yanwen } from '../../carriers/yanwen/app.js';
import { sameInstantIdentityPolicy as yunExpress } from '../../carriers/yunexpress/identity.js';
import { sameInstantIdentityPolicy as ztoInternational } from '../../carriers/zto-international/identity.js';
import { sameInstantIdentityPolicy as universal } from '../../providers/shared/app.js';
import { CARRIER_DEFINITIONS } from './definitions.js';
import type { CarrierDefinition } from './types.js';

/** Scan evidence available to the app before it reuses a stored identity. */
export interface SameInstantScan {
  readonly stage: string;
  readonly description: string;
  readonly location: string;
  readonly providerCode: string;
}

/** Carrier evidence the parcel app uses when updating a stored scan in place. */
export interface SameInstantIdentityPolicy {
  readonly sourceCarrierId: string;
  readonly storedSources: readonly string[];
  readonly requireProviderCode: boolean;
  /** Match distinct scans sharing an instant by their evidence, with unique matches in both directions. */
  readonly matchEachScan?: boolean;
  readonly matches?: (incoming: SameInstantScan, stored: SameInstantScan) => boolean;
  /**
   * The zone this source once read every wall clock in. A scan showing a wall
   * clock under another offset takes over the stored row whose instant shows
   * that wall clock in this zone, and the reverse, when the provider code
   * (required) and location agree, no event of the batch carries that row,
   * and the match is unique both ways. Wording may differ.
   */
  readonly relabelledFrom?: string;
  /**
   * The source's feeds can show one scan's wall clock under different
   * offsets. A scan showing a stored row's date and time, to the second,
   * under another offset takes over that row when the trimmed location
   * agrees, the wording agrees apart from case and spacing and is not empty,
   * the provider code agrees when both carry one, no event of the batch
   * carries that row, and the match is unique both ways.
   */
  readonly matchWallClock?: boolean;
}

const policies: ReadonlyMap<string, SameInstantIdentityPolicy> = new Map(
  [aliexpress, amazonShipping, australiaPost, austrianPost, canadaPost, chronopost, ciblex, correosExpress, correosSpain, ctt, cttyex, dhlEcommerce, dhlExpress, dpd, dpdFrance, fedex, hermesGermany, indiaPost, inpost, jdLogistics, jrt, laPoste, lbcExpress, linhan, mondialRelay, mrw, nzPost, packeta, parcelforce, posMalaysia, postlogistics, postnord, postaSlovenije, posteItaliane, posti, royalMail, sfExpress, speedpak, sunYou, thhy, ups, swissPost, yanwen, yunExpress, ztoInternational, universal].map((policy) => [policy.sourceCarrierId, policy]),
);

const wording = (scan: SameInstantScan) => scan.description.replace(/\s+/g, ' ').trim().toLowerCase();

/** One scan read twice: the same wording and place, and codes that agree when both carry one. */
function sameScan(incoming: SameInstantScan, stored: SameInstantScan): boolean {
  return wording(incoming) !== '' && wording(incoming) === wording(stored)
    && incoming.location.trim() === stored.location.trim()
    && (!incoming.providerCode || !stored.providerCode || incoming.providerCode === stored.providerCode);
}

/**
 * A carrier that gives wall clocks in no stated zone has them dated on a
 * deduced one (`dateLocalClocks`). When a release deduces a better zone, such
 * as the airport a scan names, the scan shows its stored row's wall clock
 * under another offset and takes that row over.
 */
function localClockPolicy(sourceCarrierId: string, policy: SameInstantIdentityPolicy | undefined): SameInstantIdentityPolicy | undefined {
  const definition = Object.hasOwn(CARRIER_DEFINITIONS, sourceCarrierId)
    ? (CARRIER_DEFINITIONS as Record<string, CarrierDefinition>)[sourceCarrierId] : undefined;
  if (!definition?.tracking.localClocks || policy?.matchWallClock) return policy;
  return policy ? { ...policy, matchWallClock: true } : {
    sourceCarrierId, storedSources: [sourceCarrierId], requireProviderCode: false, matchEachScan: true, matches: sameScan, matchWallClock: true,
  };
}

/** Unlisted sources cannot identify a reworded scan by its instant alone. */
export function sameInstantIdentityPolicy(
  sourceCarrierId: string,
  options: { supportsScanMatching?: boolean } = {},
): SameInstantIdentityPolicy | undefined {
  const policy = localClockPolicy(sourceCarrierId, policies.get(sourceCarrierId));
  // Older app versions only check the clock and provider code.
  return policy?.matches && !options.supportsScanMatching ? undefined : policy;
}
