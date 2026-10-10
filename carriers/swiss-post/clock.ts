import { countryTimeZone } from '../../core/time/index.js';

/**
 * Events Swiss Post relays from the destination post of a parcel it sends
 * abroad: arrival in the destination country, its customs, sorting and
 * delivery rounds. With no city, postcode or country they carry the
 * destination office's wall clock under Swiss Post's offset: an El Salvador
 * delivery round at 12:26 local came as 12:26 +02:00. UPU's record has the
 * same 12:26 at El Salvador's office, and Correos de El Salvador's own tracker
 * dates it 18:26:18 UTC (checked 2026-10-11). On an item to China, customs
 * (901, 902) came at the 11:05 and 14:30 UPU gives Beijing's and Hangzhou's
 * offices. Swiss Post's own unlocated events (813, 915) keep its clock.
 */
export const DESTINATION_EVENTS: ReadonlySet<string> = new Set(['901', '902', '909', '918', '919', '920', '921', '923', '924', '926',
  '934', '938']);

/** The English wording of those events, for relays that give no code (Ship24, 17TRACK, Postal Ninja). */
const DESTINATION_WORDING = new RegExp('^(?:arrival in destination country|customs clearance process underway|sorting - forwarding'
  + '|arrival at the processing/collection point|delivery failed: (?:recipient unknown|recipient absent|shipment undeliverable)'
  + '|retention period was extended by recipient|delivered)$', 'i');

/**
 * The clock of a Swiss Post scan as a relay gives it, when it is the
 * destination post's: worded as one of those events, with no location, on an
 * item bound for `destination`, another country, which keeps one clock. Null
 * otherwise, when the relay's reading stays.
 */
export function swissPostDestinationZone(wording: string, location: string, destination: string | null): string | null {
  if (location.trim() || !destination || destination === 'CH' || !DESTINATION_WORDING.test(wording.trim())) return null;
  return countryTimeZone(destination);
}
