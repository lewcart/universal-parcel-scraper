import type { SameInstantIdentityPolicy, SameInstantScan } from '../../core/catalog/eventIdentity.js';

/** DHL's arrival notice ends with the delivery operator's page, at times with no link. */
const PARTNER_LINK = /\s*\(Homepage \/ online shipment tracking:[^()]*\)$/i;

export const withoutPartnerLink = (text: string): string => text.replace(PARTNER_LINK, '');

const normalized = (value: string) => value.replace(/\s+/g, ' ').trim().toLocaleLowerCase('en-US');

// An arrival notice stored with the partner's link keeps its row once shown
// without it: the same place, and the same wording up to the link.
function matches(incoming: SameInstantScan, stored: SameInstantScan): boolean {
  const wording = normalized(incoming.description);
  return wording !== '' && normalized(stored.description) !== wording
    && normalized(withoutPartnerLink(stored.description)) === wording
    && normalized(incoming.location) === normalized(stored.location);
}

export const sameInstantIdentityPolicy: SameInstantIdentityPolicy = {
  sourceCarrierId: 'dhl', storedSources: ['dhl'], requireProviderCode: false,
  matchEachScan: true, matches,
};
