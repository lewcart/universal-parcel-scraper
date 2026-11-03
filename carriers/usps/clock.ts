import { DateTime } from 'luxon';
import { CLOCK_SKEW_MS } from '../../core/result/due.js';
import { firstOccurrence, usStateTimeZone, usZipState } from '../../core/time/index.js';
import { uspsStage } from './status.js';

/** A place that ends its town with a state: "EXAMPLE CITY, NY 10001". */
export const STATE_PATTERN = /,\s*([A-Z]{2})\b/;
// A facility names its state before its kind: "EXAMPLE CITY NY DISTRIBUTION CENTER",
// "EXAMPLE CITY PA PACKAGE SORTING CENTER", "ISC EXAMPLE CITY NY (USPS)".
const FACILITY_STATE = /\s([A-Z]{2})\s*(?:\(USPS\)|(?:(?:NETWORK|REGIONAL|INTERNATIONAL)\s+)?DISTRIBUTION\s+CENTER|PACKAGE\s+SORTING\s+CENTER)$/;
// A place that gives only its ZIP code, after its town or alone: "EXAMPLE CITY 10001", "10001".
const ZIP_ONLY = /^(?:[A-Z][A-Z .'-]*?,?\s+)?(\d{5}(?:-\d{4})?)$/i;

/**
 * The zone of a USPS scan's wall clock: that of the state its place names,
 * the facility's own, or else the state its ZIP code is in, in the state's
 * majority zone. Null when the place gives neither.
 */
export function uspsScanZone(location: string): string | null {
  const state = STATE_PATTERN.exec(location)?.[1] ?? FACILITY_STATE.exec(location)?.[1];
  return state ? usStateTimeZone(state) : usStateTimeZone(usZipState(ZIP_ONLY.exec(location.trim())?.[1]));
}

/**
 * The zone of a row's wall clock, given its facility's zone. A mailer can write its labels on
 * UTC: a label row ("Shipping Label Created", "Pre-Shipment Info Sent") that the facility's zone
 * dates after `readAt`, and UTC does not, is read on UTC. Any other row keeps the facility's
 * zone, and so does a label older than the gap between the two, which nothing tells apart.
 */
export function uspsRowZone(wall: string, facility: string, description: string, readAt: number): string {
  if (uspsStage(description) !== 'registered') return facility;
  const ahead = (zone: string) => firstOccurrence(DateTime.fromISO(wall, { zone })).toMillis() > readAt + CLOCK_SKEW_MS;
  return ahead(facility) && !ahead('UTC') ? 'UTC' : facility;
}
