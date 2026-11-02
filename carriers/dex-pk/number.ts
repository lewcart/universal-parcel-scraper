import { normalizeTrackingNumber } from '../../core/detection/normalize.js';
import { InvalidInputError } from '../../core/errors/index.js';

/** The existing DEX Pakistan number shape, printed as the official tracker requires it. */
export function normalizeDexPkNumber(raw: string): string {
  const number = typeof raw === 'string' && raw.length <= 64 ? normalizeTrackingNumber(raw) : '';
  if (!/^PKDEX\d{9}$/.test(number)) {
    throw new InvalidInputError('DEX Pakistan', 'DEX Pakistan numbers are PK-DEX and nine digits');
  }
  return `PK-DEX${number.slice(5)}`;
}
