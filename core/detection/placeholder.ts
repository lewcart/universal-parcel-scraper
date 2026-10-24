import { normalizeTrackingNumber } from './normalize.js';

/**
 * Placeholder numbers: the zeros, repeated digits and 123456789 runs typed to
 * try a form. Many trackers file test labels and stray scans under them and
 * show those shipments to anyone who asks, so lookups refuse them.
 * What it is not: detection still reads the shape, and a carrier's own checks
 * still decide whether it issues the number.
 */

const ASCENDING = '0123456789'.repeat(5);
const DESCENDING = '9876543210'.repeat(5);

/**
 * Whether the number is a placeholder rather than one a carrier issued: apart
 * from a letter prefix and suffix, six or more digits that repeat one digit or
 * run straight up or down. An S10 item is read by its serial without the check
 * digit, so the UPU's own example, RR123456785…, is one too.
 */
export function isPlaceholderNumber(raw: string): boolean {
  const number = normalizeTrackingNumber(raw);
  const digits = /^[A-Z]{2}(\d{8})\d[A-Z]{2}$/.exec(number)?.[1] ?? /^[A-Z]*(\d{6,})[A-Z]*$/.exec(number)?.[1];
  return digits !== undefined && (/^(\d)\1+$/.test(digits) || ASCENDING.includes(digits) || DESCENDING.includes(digits));
}
