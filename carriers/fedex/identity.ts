import type { SameInstantIdentityPolicy } from '../../core/catalog/eventIdentity.js';

// The official API and the tracking page's own reply can word or place one
// scan differently. A scan read from one takes over the row the other stored
// at its instant when both read it as the same step.
export const sameInstantIdentityPolicy: SameInstantIdentityPolicy = {
  sourceCarrierId: 'fedex', storedSources: ['fedex'], requireProviderCode: false,
  matches: (incoming, stored) => incoming.stage === stored.stage,
};
