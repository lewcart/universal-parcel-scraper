import { CARRIER_DEFINITIONS } from '../catalog/definitions.js';

/**
 * A customer parcel ID ("ID collo cliente") of EOB and seventeen digits. The
 * sender applies it, so no detection rule claims it for BRT, but BRT's parcel
 * search finds it.
 */
export function isBrtCustomerParcelId(number: string): boolean {
  return /^EOB\d{17}$/.test(number);
}

/** Complete identifiers accepted by BRT's shipment-number and parcel-label requests. */
export function isBrtTrackingNumber(number: string): boolean {
  return CARRIER_DEFINITIONS.brt.detectionRules.some(rule => new RegExp(rule.pattern).test(number)) || isBrtCustomerParcelId(number);
}
