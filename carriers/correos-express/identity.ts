import type { SameInstantIdentityPolicy, SameInstantScan } from '../../core/catalog/eventIdentity.js';
import { classifyCorreosExpressDescription, correosExpressDescriptionLabel } from './status.js';

const normalized = (value: string) => value.replace(/\s+/g, ' ').trim().toLocaleUpperCase('es-ES');
// The neutral wording a scan with an unrecognized label is stored under.
const NEUTRAL = 'TRACKING UPDATE';

// A scan stored under the neutral wording before its label was recognized
// takes its label and stage in place, and one stored without the fixed
// explanation of its label takes it; the town still names the same scan.
// Correos Express scans carry only a local time, and apps store only scans
// with an instant, so this matters only once a scan has one.
function matches(incoming: SameInstantScan, stored: SameInstantScan): boolean {
  const location = normalized(incoming.location);
  if (location !== normalized(stored.location)) return false;
  const wording = normalized(incoming.description);
  if (!wording) return false;
  if (wording === normalized(stored.description)) return true;
  if (classifyCorreosExpressDescription(incoming.description) === undefined) return false;
  return normalized(stored.description) === NEUTRAL
    || normalized(correosExpressDescriptionLabel(incoming.description)) === normalized(correosExpressDescriptionLabel(stored.description));
}

export const sameInstantIdentityPolicy: SameInstantIdentityPolicy = {
  sourceCarrierId: 'correos-express', storedSources: ['correos-express'], requireProviderCode: false,
  matchEachScan: true, matches,
};
