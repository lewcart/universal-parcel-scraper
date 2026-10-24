import type { SameInstantIdentityPolicy, SameInstantScan } from '../../core/catalog/eventIdentity.js';

const place = (value: string) => value.replace(/\s+/g, ' ').trim().toLocaleLowerCase('de-DE');

// The app service and the guest API answer apart and date one scan to the
// minute and to the second, in their own wording. Only the guest API's scans
// carry DPD's code, and its unverified reply names no place. A scan from one
// service matches a stored scan from the other at the same stage and place,
// or where one of them names none.
function matches(incoming: SameInstantScan, stored: SameInstantScan): boolean {
  const [location, saved] = [place(incoming.location), place(stored.location)];
  return incoming.stage !== '' && incoming.stage === stored.stage
    && !incoming.providerCode !== !stored.providerCode
    && (location === saved || !location || !saved);
}

export const sameInstantIdentityPolicy: SameInstantIdentityPolicy = {
  sourceCarrierId: 'dpd-de', storedSources: ['dpd-de'], requireProviderCode: false, matchEachScan: true, matches, matchWithinMinute: true,
};
