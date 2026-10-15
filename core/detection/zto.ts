import { CARRIER_DEFINITIONS } from '../catalog/definitions.js';

/** Domestic candidate shapes; only a matching tracking reply confirms ZTO. */
export function isZtoTrackingNumber(number: string): boolean {
  return CARRIER_DEFINITIONS.zto.detectionRules.some(rule => new RegExp(rule.pattern).test(number));
}
