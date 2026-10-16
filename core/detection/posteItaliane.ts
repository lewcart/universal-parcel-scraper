import { CARRIER_DEFINITIONS } from '../catalog/definitions.js';
import { CHECKSUMS } from './checksums.js';

/** Catalog shape and check-digit eligibility; a matching Poste lookup must still establish the shipment. */
export function isPosteItalianeTrackingNumber(number: string): boolean {
  return CARRIER_DEFINITIONS['poste-italiane'].detectionRules.some(rule => new RegExp(rule.pattern).test(number)
    && (rule.checksum === undefined || CHECKSUMS[rule.checksum](number)));
}
