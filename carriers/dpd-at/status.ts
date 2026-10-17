import { classifyWording, type ClassifiedWording, type Stage } from '../../core/status/index.js';
import type { CarrierStatusMap } from '../../core/status/statusMap.js';

/**
 * myDPD's names for a scan's state, which the adapter keeps as the provider
 * code. A state the page qualifies, such as a hand-over at a Pickup station,
 * carries the qualifier after a slash (`HANDOVER/BOX`). Only names seen in
 * replies are mapped; another name falls to the wording rules.
 */
const NAMES: ReadonlyMap<string, Stage> = new Map([
  ['ORDER_DATA', 'registered'], // The sender's data reached DPD.
  ['ON_THE_WAY', 'in_transit'], // Collected, or through a hub.
  ['IN_DEPOT', 'in_transit'], // At the depot that delivers it.
  ['IN_DELIVERY', 'out_for_delivery'], // With the driver, to the door or, qualified `BOX`, to a Pickup station.
  ['NAB', 'failed_attempt'], // The recipient was not in.
  ['RECEIVER_PICKUP', 'delivered'], // Collected by the recipient from a Pickup point.
  ['DELIVERED', 'delivered'], // Qualified `ASG` when left at the recipient's chosen place.
]);

/** States whose stage depends on the qualifier: a hand-over is a delivery only when it says where to. */
const QUALIFIED: ReadonlyMap<string, Stage> = new Map([
  ['HANDOVER/BOX', 'ready_for_pickup'], // Left in a Pickup station for collection.
]);

/** The stage myDPD's names give a provider code. */
export function dpdAtMappedStage(code: string): Stage | undefined {
  const key = code.toUpperCase();
  return QUALIFIED.get(key) ?? NAMES.get(key.split('/')[0]!);
}

/** A scan's stage: its state's name, else the shared wording rules, else nothing. */
export function dpdAtStage(code: string, wording: string): ClassifiedWording | null {
  const mapped = dpdAtMappedStage(code);
  if (mapped) return { stage: mapped, source: 'carrier_map' };
  const worded = classifyWording(wording, 'in_transit');
  return worded.source === 'none' ? null : worded;
}

export const statusMap: CarrierStatusMap = {
  stage: (code) => (code ? dpdAtMappedStage(code) : undefined),
  gaps: [],
};
