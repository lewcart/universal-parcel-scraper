import type { SameInstantIdentityPolicy, SameInstantScan } from '../../core/catalog/eventIdentity.js';

const wording = (scan: SameInstantScan) => scan.description.replace(/\s+/g, ' ').trim().toLowerCase();

/** One row, by its wording and place. CTTYEX's rows have no code. */
function sameRow(incoming: SameInstantScan, stored: SameInstantScan): boolean {
  return wording(incoming) !== '' && wording(incoming) === wording(stored) && incoming.location.trim() === stored.location.trim();
}

// A wording the map comes to list as a step in China is read on Beijing time
// instead of its wall clock, and takes over the row stored from that clock.
export const sameInstantIdentityPolicy: SameInstantIdentityPolicy = {
  sourceCarrierId: 'cttyex', storedSources: ['cttyex'], requireProviderCode: false,
  matchEachScan: true, matches: sameRow, matchWallClock: true,
};
