/**
 * UPU S10 check digit.
 *
 * What it is: the single S10 validator used by the client, the server adapters
 * and the detection rules that declare `"checksum": "s10"`, and the same check
 * digit on Pos Laju's three-letter consignments.
 * What it is not: no carrier lookup and no provider I/O. The S10 validator
 * normalizes its input, so callers may pass a raw or an already-normalized
 * number; the Pos Laju check, like the other checksums, takes a normalized one.
 */
import { normalizeTrackingNumber } from './normalize.js';

/** The ninth of nine digits checks the first eight: weights 8, 6, 4, 2, 3, 5, 9, 7, then 11 minus the sum mod 11. */
function hasS10CheckDigit(digits: string): boolean {
  const weights = [8, 6, 4, 2, 3, 5, 9, 7];
  const sum = weights.reduce((total, weight, index) => total + Number(digits[index]) * weight, 0);
  const rawCheckDigit = 11 - (sum % 11);
  const expected = rawCheckDigit === 10 ? 0 : rawCheckDigit === 11 ? 5 : rawCheckDigit;
  return Number(digits[8]) === expected;
}

/** Validate the UPU S10 check digit, not only its broad A2-N9-A2 shape. */
export function isValidS10TrackingNumber(raw: string): boolean {
  const value = normalizeTrackingNumber(raw);
  return /^[A-Z]{2}\d{9}[A-Z]{2}$/.test(value) && hasS10CheckDigit(value.slice(2, 11));
}

/**
 * A Pos Laju consignment: three letters, nine digits and MY. The ninth digit
 * is the S10 check digit of the eight before it, as on every archived public
 * consignment; the extra letter is outside the check.
 */
export function isValidPosLajuConsignment(value: string): boolean {
  return /^[A-Z]{3}\d{9}MY$/.test(value) && hasS10CheckDigit(value.slice(3, 12));
}

/** Swiss-issued tracked letter-post can move from Cainiao to Swiss Post. */
export function supportsSwissPostHandoff(raw: string): boolean {
  const value = normalizeTrackingNumber(raw);
  return /^L[A-Z]\d{9}CH$/.test(value) && isValidS10TrackingNumber(value);
}
