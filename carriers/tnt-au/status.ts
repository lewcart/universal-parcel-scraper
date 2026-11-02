import { classifyWording, type ClassifiedWording, type Stage } from '../../core/status/index.js';
import { normalizeStatusWording, type CarrierStatusMap } from '../../core/status/statusMap.js';

const key = (wording: string) => normalizeStatusWording(wording);

/**
 * TNT Australia's scan wordings, which come without codes. Only wordings seen
 * on its tracker are mapped; another falls to the shared wording rules.
 */
const WORDINGS: ReadonlyMap<string, Stage> = new Map([
  // The sender's system sent the consignment's details; TNT has not seen the parcel.
  [key('Your shipment data is lodged'), 'registered'],
  // Picked up from the sender. The receiver collecting it is "Your shipment was collected".
  [key("We've collected your shipment"), 'accepted'],
  [key("We're processing your shipment"), 'in_transit'],
  [key('Your shipment is in transit'), 'in_transit'],
  [key("Your shipment's with a driver"), 'out_for_delivery'],
  [key('Delivery attempted - card left'), 'failed_attempt'],
  // Back at the depot at the end of a round that did not deliver it.
  [key('Delivery returned to depot'), 'failed_attempt'],
  // The parcel cannot go out until the receiver gives another address.
  [key('New delivery address required'), 'exception'],
  [key("We've delivered your shipment"), 'delivered'],
  // The receiver collected it from the depot that held it.
  [key('Your shipment was collected'), 'delivered'],
]);

// A delivery the receiver booked, asked for or was offered, at the depot that delivers:
// a note, not a scan, and it can come after the delivery or carry the booked time.
const NOTICES: ReadonlySet<string> = new Set([
  key('Book-In Delivery Requested'),
  key('Book-In Delivery Arranged'),
  key('Delivery booked in'),
]);

const NOTICE = 'A delivery booking or a request for one: a note, not a scan, so the parcel keeps the stage it had.';

/** The stage TNT Australia's map gives a wording, if it knows the wording. */
export function tntAustraliaMappedStage(wording: string): Stage | undefined {
  return WORDINGS.get(key(wording));
}

/** A scan's stage: the map, else nothing for a booking note, else the shared wording rules. */
export function tntAustraliaStage(wording: string): ClassifiedWording | null {
  const mapped = tntAustraliaMappedStage(wording);
  if (mapped) return { stage: mapped, source: 'carrier_map' };
  if (NOTICES.has(key(wording))) return null;
  const worded = classifyWording(wording, 'in_transit');
  return worded.source === 'none' ? null : worded;
}

/** Scans come without a code; the booking notes are left without a stage on purpose. */
export const statusMap: CarrierStatusMap = {
  stage: (code, wording) => (code === null ? tntAustraliaMappedStage(wording) : undefined),
  gaps: [...NOTICES].map((wording) => ({ wording, note: NOTICE })),
};
