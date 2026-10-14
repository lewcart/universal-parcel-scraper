import type { SameInstantIdentityPolicy } from '../../core/catalog/eventIdentity.js';
import { matchesDroppedLocation, matchesLocationEnrichment } from '../../core/catalog/locationIdentity.js';

/** A site number or postcode stored as the whole location of a scan with no town or country. */
const bareNumber = (location: string) => /^\d+$/.test(location);

// The destination post's scans of a parcel sent abroad came with Swiss Post's
// Zurich offset until October 2026, and now show the destination's when it
// keeps one clock. A scan stored with a bare number as its location loses it.
export const sameInstantIdentityPolicy: SameInstantIdentityPolicy = {
  sourceCarrierId: 'swiss-post', storedSources: ['swiss-post'], requireProviderCode: true,
  matchEachScan: true,
  matches: (incoming, stored) => matchesLocationEnrichment(incoming, stored)
    || matchesDroppedLocation(incoming, stored, bareNumber),
  relabelledFrom: 'Europe/Zurich',
};
