import type { SameInstantIdentityPolicy } from '../../core/catalog/eventIdentity.js';

// Scans stored while the localizador answered in Spanish take its English
// wording in place: at one instant, the event code names the same scan. An
// origin post's scans on an item from abroad kept the Madrid reading until
// October 2026 and now show that post's clock, unless its country keeps several.
export const sameInstantIdentityPolicy: SameInstantIdentityPolicy = {
  sourceCarrierId: 'correos-spain', storedSources: ['correos-spain'], requireProviderCode: true, relabelledFrom: 'Europe/Madrid',
};
