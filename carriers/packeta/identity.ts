import type { SameInstantIdentityPolicy } from '../../core/catalog/eventIdentity.js';
import { packetaEventText } from './text.js';

// Hand-off scans stored with their partner link's markup read the same
// sentence without it, at the same instant.
export const sameInstantIdentityPolicy: SameInstantIdentityPolicy = {
  sourceCarrierId: 'packeta', storedSources: ['packeta'], requireProviderCode: false,
  matchEachScan: true,
  matches: (incoming, stored) => incoming.description !== '' && incoming.location === stored.location
    && incoming.description === packetaEventText(stored.description),
};
