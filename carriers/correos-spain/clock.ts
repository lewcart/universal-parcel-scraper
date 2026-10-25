import { isValidS10TrackingNumber } from '../../core/detection/s10.js';
import { countryCode, countryTimeZone } from '../../core/time/index.js';

/** Correos's own clock: mainland Spain's. */
export const CORREOS_HOME_ZONE = 'Europe/Madrid';

/**
 * On an item from abroad, Correos lists the origin post's scans at its outward
 * office of exchange (B030000V) and in its customs (B170000V) at that post's
 * wall clock: India Post's own scans have the same minutes on Kolkata time,
 * and Japan Post's on Tokyo time. Correos's own scans, from C010000V on, are
 * on Madrid's clock.
 */
const ORIGIN_CODE = /^B\d/;

/**
 * Correos's summaries of those scans, for relays that give no code: alone, or
 * as one part of 17TRACK's "PHASE, summary, details".
 */
const ORIGIN_WORDING = /(?:^|,)\s*(?:en oficina de cambio|en aduana de origen|in the exchange office)\s*(?:,|$)/i;

/**
 * The country of the post that sent an item from abroad, which its S10 code's
 * suffix names; null for Spain's own items and other codes.
 */
function foreignOrigin(number: string): string | null {
  const country = isValidS10TrackingNumber(number) ? countryCode(number.slice(-2)) : null;
  return country && country !== 'ES' ? country : null;
}

/**
 * The clock of a Correos scan of `number`, known by its code or, from a relay,
 * by its wording, when it is the origin post's on an item from abroad: the
 * zone of the country the S10 code's suffix names, or null when that country
 * keeps several clocks and the scan keeps its wall clock. Undefined for any
 * other scan, which is on Madrid's clock.
 */
export function correosOriginZone(number: string, scan: { code: string } | { wording: string }): string | null | undefined {
  const origin = 'code' in scan ? ORIGIN_CODE.test(scan.code) : ORIGIN_WORDING.test(scan.wording);
  const country = origin ? foreignOrigin(number) : null;
  return country ? countryTimeZone(country) : undefined;
}
