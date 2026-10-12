import type { SameInstantIdentityPolicy } from '../../core/catalog/eventIdentity.js';

// Scans abroad kept the UK offset Royal Mail labels them with until October
// 2026 and now show their country's, unless the country keeps several clocks.
export const sameInstantIdentityPolicy: SameInstantIdentityPolicy = {
  sourceCarrierId: 'royal-mail', storedSources: ['royal-mail'], requireProviderCode: true, relabelledFrom: 'Europe/London',
};
