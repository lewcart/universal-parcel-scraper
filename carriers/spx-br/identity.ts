import type { SameInstantIdentityPolicy } from '../../core/catalog/eventIdentity.js';
import { spxBrPlacedText } from './parser.js';

// A scan stored with its centre, origin or port in its wording reads the same
// wording without it, at the same instant, with that place or the reply's own.
export const sameInstantIdentityPolicy: SameInstantIdentityPolicy = {
  sourceCarrierId: 'spx-br', storedSources: ['spx-br'], requireProviderCode: false,
  matchEachScan: true,
  matches: (incoming, stored) => {
    if (incoming.description === '' || incoming.providerCode !== stored.providerCode) return false;
    if (incoming.description === stored.description) return incoming.location === stored.location;
    const placed = spxBrPlacedText(stored.description);
    return placed.description === incoming.description
      && (incoming.location === stored.location || (stored.location === '' && incoming.location === placed.location));
  },
};
