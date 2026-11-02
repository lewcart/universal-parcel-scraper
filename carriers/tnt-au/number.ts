import { normalizeTrackingNumber } from '../../core/detection/normalize.js';
import { InvalidInputError } from '../../core/errors/index.js';

// A domestic consignment: the sender account's three letters and nine digits, or seven on
// older consignments. The letters are the account's, not a check, so any three can start one.
const CONSIGNMENT = /^[A-Z]{3}(?:\d{7}|\d{9})$/;

/**
 * A TNT Australia domestic consignment as its tracker finds it. Shared by the
 * adapter's request and the tracking link.
 */
export function normalizeTntAustraliaNumber(raw: string): string {
  const number = typeof raw === 'string' && raw.length <= 64 ? normalizeTrackingNumber(raw) : '';
  if (!CONSIGNMENT.test(number)) {
    throw new InvalidInputError('TNT Australia', 'TNT Australia consignments are three letters and nine digits, or seven on older ones');
  }
  return number;
}
