import type { SameInstantIdentityPolicy } from '../../core/catalog/eventIdentity.js';
import { matchesLocationEnrichment } from '../../core/catalog/locationIdentity.js';

// The destination post's scans of a parcel sent abroad came with Swiss Post's
// Zurich offset until October 2026, and now show the destination's when it
// keeps one clock.
export const sameInstantIdentityPolicy: SameInstantIdentityPolicy = {
  sourceCarrierId: 'swiss-post', storedSources: ['swiss-post'], requireProviderCode: true,
  matchEachScan: true,
  matches: matchesLocationEnrichment,
  relabelledFrom: 'Europe/Zurich',
};
