import { usStateTimeZone } from '../../core/time/index.js';

/** A place that ends its town with a state: "EXAMPLE CITY, NY 10001". */
export const STATE_PATTERN = /,\s*([A-Z]{2})\b/;
// A facility names its state before its kind: "EXAMPLE CITY NY DISTRIBUTION CENTER",
// "EXAMPLE CITY PA PACKAGE SORTING CENTER", "ISC EXAMPLE CITY NY (USPS)".
const FACILITY_STATE = /\s([A-Z]{2})\s*(?:\(USPS\)|(?:(?:NETWORK|REGIONAL|INTERNATIONAL)\s+)?DISTRIBUTION\s+CENTER|PACKAGE\s+SORTING\s+CENTER)$/;

/**
 * The zone of a USPS scan's wall clock: that of the state its place names,
 * the facility's own, in the state's majority zone. Null when the place names
 * no state.
 */
export function uspsScanZone(location: string): string | null {
  return usStateTimeZone(STATE_PATTERN.exec(location)?.[1] ?? FACILITY_STATE.exec(location)?.[1]);
}
