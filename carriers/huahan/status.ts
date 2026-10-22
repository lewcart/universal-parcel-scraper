import { classifyWording, type ClassifiedWording, type Stage } from '../../core/status/index.js';
import { normalizeStatusWording, type CarrierStatusMap } from '../../core/status/statusMap.js';

// The origin milestone codes are documented by getCargoTrack. The web tracker
// adds the flight and clearance milestones, JY for the hand-off to the
// destination carrier, and codes for that carrier's out-for-delivery (CB),
// delivery-point arrival (PB) and delivery (CC) scans. IA covers that carrier's
// other scans: the map reads the wordings seen, the shared rules the rest.
const CODES: ReadonlyMap<string, Stage> = new Map([
  ['IR', 'registered'], ['AF', 'accepted'], ['DF', 'in_transit'], ['GG', 'in_transit'], ['BG', 'in_transit'],
  ['QF', 'in_transit'], ['QG', 'customs'], ['LD', 'in_transit'], ['YG', 'in_transit'], ['JY', 'in_transit'],
  ['CB', 'out_for_delivery'], ['PB', 'ready_for_pickup'], ['CC', 'delivered'],
]);
// Scans under IA, or relayed without a code: "Data processed" comes between departures from the
// origin facility; the rest are the destination carrier's, after the hand-off, in its words.
const WORDINGS: ReadonlyMap<string, Stage> = new Map([
  ['data processed', 'in_transit'],
  ['we will pick up your parcel from the sender soon.', 'registered'],
  ['ready to ship, parcel received and processed', 'in_transit'],
  ['shipped', 'in_transit'],
  ['the parcel is in the central warehouse waiting to be processed.', 'in_transit'],
  ['in transit, shipment arrived to sorting centre / shipment in the sorting centre', 'in_transit'],
  ['in transit', 'in_transit'],
  ['the parcel is on the way to the local warehouse.', 'in_transit'],
  ['in transit, shipment remained at sorting hub', 'in_transit'],
  ['the courier will deliver the parcel soon. additional details are available in the sameday app, email or sms.', 'out_for_delivery'],
]);

const GAPS = [{
  wording: 'the parcel was redirected. as soon as it is in the couriers possession, it will be processed as requested.',
  note: "The destination carrier's record of the recipient's redirection, written while the parcel was still in China: it moves nothing.",
}];
const GAP_WORDINGS = new Set(GAPS.map((gap) => gap.wording));

function mappedStage(code: string, wording: string): Stage | undefined {
  return CODES.get(code) ?? (!code || code === 'IA' ? WORDINGS.get(wording) : undefined);
}

/** A scan's stage: its code or wording in the map, else the shared rules, else nothing. A recorded gap has none. */
export function huahanStage(code: string, wording: string): ClassifiedWording | null {
  const key = normalizeStatusWording(wording);
  if (!code && GAP_WORDINGS.has(key)) return null;
  const stage = mappedStage(code, key);
  if (stage) return { stage, source: 'carrier_map' };
  const classified = classifyWording(wording, 'pending');
  return classified.source === 'none' ? null : classified;
}

export const statusMap: CarrierStatusMap = {
  stage: (code, wording) => mappedStage(code ?? '', wording),
  gaps: GAPS,
};
