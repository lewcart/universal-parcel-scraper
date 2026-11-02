import { classifyWording, type ClassifiedWording, type Stage } from '../../core/status/index.js';
import type { CarrierStatusMap } from '../../core/status/statusMap.js';

/**
 * The event codes the tracker's script draws an icon for. A code it does not know falls to the
 * shared wording rules on the event's message.
 */
const CODES: ReadonlyMap<string, Stage> = new Map([
  // The electronic notice to the office of exchange that a dispatch is coming.
  ['OFFICE_OF_EXCHANGE_PREALERT', 'registered'],
  ['OFFICE_OF_EXCHANGE_DEPARTED', 'in_transit'],
  ['ITEM_AT_DELIVERY_DEPOT', 'in_transit'],
  ['DELIVERED', 'delivered'],
]);

/** An event's stage: its code, else its message by the shared rules, else nothing. */
export function logisticsSolutionStage(code: string, message: string): ClassifiedWording | null {
  const mapped = CODES.get(code);
  if (mapped) return { stage: mapped, source: 'carrier_map' };
  if (!message) return null;
  const worded = classifyWording(message, 'in_transit');
  return worded.source === 'none' ? null : worded;
}

export const statusMap: CarrierStatusMap = { stage: (code) => (code ? CODES.get(code) : undefined), gaps: [] };
