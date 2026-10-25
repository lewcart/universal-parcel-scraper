import { normalizeStatusWording, type CarrierStatusMap } from '../../core/status/statusMap.js';
import { EVRI_UK_DELIVERED } from './parser.js';

/**
 * What the map says about one scan. Its rail sets its stage, and the stored row keeps only its
 * tracking point, which sits on rails of different stages: a ParcelShop arrival is the drop-off
 * on rail 2 and the parcel awaiting collection on 4_SHOP. So a code stages nothing alone, and
 * only the wording both tiers write for every delivery stages a scan. Every other scan stays
 * open rather than a declared gap, so a scan on a rail the adapter does not know still reaches
 * the review.
 */
export const statusMap: CarrierStatusMap = {
  stage: (_code, wording) => (wording === normalizeStatusWording(EVRI_UK_DELIVERED) ? 'delivered' : undefined),
  gaps: [],
};
