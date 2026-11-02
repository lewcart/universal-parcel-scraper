import type { SameInstantIdentityPolicy, SameInstantScan } from '../../core/catalog/eventIdentity.js';
import { matchesDroppedLocation, matchesRereadLocation } from '../../core/catalog/locationIdentity.js';
import { hualeiPlace } from './text.js';

const normalized = (value: string) => value.replace(/\s+/g, ' ').trim().toLocaleLowerCase('en-US');

// A row stored at a word the tracker prints for no place, such as "SYSTEM", is taken over by the
// same wording without it, whatever stage the tenant's map has given that wording since.
function placeless(incoming: SameInstantScan, stored: SameInstantScan): boolean {
  const wording = normalized(incoming.description);
  return Boolean(wording) && wording === normalized(stored.description) && !incoming.location.trim()
    && Boolean(stored.location.trim()) && !hualeiPlace(stored.location);
}

/**
 * A tenant's rows as the shared client rereads them: a delivery row stored with the recipient's
 * postcode in its place takes the place without it, or none, and so does a row stored at "SYSTEM".
 */
export function hualeiIdentityPolicy(sourceCarrierId: string): SameInstantIdentityPolicy {
  return {
    sourceCarrierId, storedSources: [sourceCarrierId], requireProviderCode: false,
    matchEachScan: true,
    matches: (incoming, stored) => matchesRereadLocation(incoming, stored, hualeiPlace)
      || matchesDroppedLocation(incoming, stored, (location) => !hualeiPlace(location)) || placeless(incoming, stored),
  };
}

export const sameInstantIdentityPolicy = hualeiIdentityPolicy('gzyl');
