import { classifyWording, type ClassifiedWording, type Stage } from '../../core/status/index.js';
import { normalizeStatusWording, type CarrierStatusMap } from '../../core/status/statusMap.js';

// The origin milestone codes are documented by getCargoTrack. The web tracker
// adds the flight and clearance milestones, JY for the hand-off to the
// destination carrier, and codes for that carrier's out-for-delivery (CB),
// delivery-point arrival (PB) and delivery (CC) scans. IA covers that carrier's
// other scans, which its wording places.
const CODES: ReadonlyMap<string, Stage> = new Map([
  ['IR', 'registered'], ['AF', 'accepted'], ['DF', 'in_transit'], ['GG', 'in_transit'], ['BG', 'in_transit'],
  ['QF', 'in_transit'], ['QG', 'customs'], ['LD', 'in_transit'], ['YG', 'in_transit'], ['JY', 'in_transit'],
  ['CB', 'out_for_delivery'], ['PB', 'ready_for_pickup'], ['CC', 'delivered'],
]);
// Scans 17TRACK relays without their code: "Data processed" comes between departures from the origin facility.
const WORDINGS: ReadonlyMap<string, Stage> = new Map([['data processed', 'in_transit']]);

export function huahanStage(code: string, wording: string): ClassifiedWording | null {
  const stage = CODES.get(code) ?? (code ? undefined : WORDINGS.get(normalizeStatusWording(wording)));
  if (stage) return { stage, source: 'carrier_map' };
  const classified = classifyWording(wording, 'pending');
  return classified.source === 'none' ? null : classified;
}

export const statusMap: CarrierStatusMap = {
  stage: (code, wording) => (code ? CODES.get(code) : WORDINGS.get(wording)),
  gaps: [],
};
