import { CARRIER_DEFINITIONS } from '../catalog/definitions.js';
import { CHECKSUMS } from './checksums.js';

/** Catalog shape and check-digit eligibility; a matching Poste lookup must still establish the shipment. */
export function isPosteItalianeTrackingNumber(number: string): boolean {
  return CARRIER_DEFINITIONS['poste-italiane'].detectionRules.some(rule => new RegExp(rule.pattern).test(number)
    && (rule.checksum === undefined || CHECKSUMS[rule.checksum](number)));
}

/**
 * A DHL Parcel Connect plate that a partner abroad, such as PPL, hands to Poste Italiane with a
 * link to Poste's tracker. DHL issues it, so no detection rule names Poste for it.
 */
export function isPosteItalianePartnerPlate(number: string): boolean {
  return /^JJD\d{21}$/.test(number);
}
