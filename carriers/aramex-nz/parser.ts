import type { CarrierResult } from '../../core/result/index.js';
import { normalizeAramexNumber, parseAramex, type AramexNetwork } from '../aramex-au/parser.js';
import { aramexNzStage } from './status.js';

export const PROVIDER = 'Aramex New Zealand';

// Aramex New Zealand runs Aramex Australia's tracker on its own host and
// database. Its page shows every scan, with no place for those before pickup,
// and every depot keeps New Zealand's clock.
const NEW_ZEALAND: AramexNetwork = {
  provider: PROVIDER,
  sscc: false,
  hidden: new Set(),
  placeless: new Set(['IOC', 'PP0', 'PP2', 'PP3', 'PP4', 'PP5', 'PP7']),
  // A courier's run is named after its area and numbered: the area is the place.
  place: (name) => name.replace(/\s+Zone\s+\d+$/i, ''),
  stage: aramexNzStage,
  zone: 'Pacific/Auckland',
  priority: false,
  // The page shows the estimate only with both depots known.
  showsEstimate: (result) => typeof result.PickupFranchiseCode === 'string' && result.PickupFranchiseCode.trim() !== '',
};

/** A number as the tracker looks it up: upper case, without spaces or dashes. */
export function normalizeAramexNzNumber(raw: string): string {
  return normalizeAramexNumber(raw, NEW_ZEALAND);
}

/** The reply of Aramex New Zealand's tracking service for one number. */
export function parseAramexNz(payload: unknown, raw: string): CarrierResult {
  return parseAramex(payload, raw, NEW_ZEALAND);
}
