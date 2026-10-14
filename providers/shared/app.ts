import type { SameInstantIdentityPolicy } from '../../core/catalog/eventIdentity.js';
import { matchesLocationEnrichment, matchesRereadLocation } from '../../core/catalog/locationIdentity.js';
import { place } from './result.js';

// A copy may add a place, or drop a label it was once stored with that names
// no place (Posti's "abroad", a feed's system user) or the words before a
// depot's town.
export const sameInstantIdentityPolicy: SameInstantIdentityPolicy = {
  sourceCarrierId: 'unknown', storedSources: ['unknown'], requireProviderCode: false,
  matchEachScan: true,
  matches: (incoming, stored) => matchesLocationEnrichment(incoming, stored)
    || matchesRereadLocation(incoming, stored, place),
};
