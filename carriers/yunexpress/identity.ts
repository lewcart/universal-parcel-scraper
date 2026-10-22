import type { SameInstantIdentityPolicy, SameInstantScan } from '../../core/catalog/eventIdentity.js';

const wording = (scan: SameInstantScan) => scan.description.replace(/\s+/g, ' ').trim().toLowerCase();

/** One row, by its wording and place. Yuntrack's rows have no code. */
function sameRow(incoming: SameInstantScan, stored: SameInstantScan): boolean {
  return wording(incoming) !== '' && wording(incoming) === wording(stored) && incoming.location.trim() === stored.location.trim();
}

// Earlier releases dated the rows without a place on China's leg on the
// destination's zone for Node lookups. Read on China's clock, a row shows the
// same wall clock under another offset and takes over the row stored from it.
export const sameInstantIdentityPolicy: SameInstantIdentityPolicy = {
  sourceCarrierId: 'yunexpress', storedSources: ['yunexpress'], requireProviderCode: false,
  matchEachScan: true, matches: sameRow, matchWallClock: true,
};
