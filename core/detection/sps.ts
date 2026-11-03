/**
 * The references Slovak Parcel Service's tracker looks up: its parcel number (703 and eleven
 * digits), the sixteen-digit barcode that extends it, the eleven characters without 703, and an
 * SK label code. Its adapter refuses any other before a request, so a hand-off asks it about no other.
 */
export const SPS_PARCEL = /^703\d{11}$/;
export const SPS_BARCODE = /^703\d{11}[0-4]\d$/;
export const SPS_LOCAL = /^[0-9A-Z]\d{10}$/;
export const SPS_LABEL = /^SK[A-HJ-NP-Z0-9]{5}\d{2}[A-HJ-NP-Z0-9]{9}$/;

/** Whether Slovak Parcel Service's tracker looks up the normalized reference. */
export function isSpsLookup(number: string): boolean {
  return [SPS_PARCEL, SPS_BARCODE, SPS_LOCAL, SPS_LABEL].some((pattern) => pattern.test(number));
}
