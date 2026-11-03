import type { Stage } from '../../core/status/index.js';
import type { CarrierStatusMap } from '../../core/status/statusMap.js';

/**
 * WooliiPorter's status codes, for the shipment and for each scan. The tracking page's script
 * lists them with its own labels; "Handed over" is the first physical scan, as the page says
 * before it that the first physical scan has not arrived.
 */
const CODES: ReadonlyMap<string, Stage> = new Map([
  ['INFO_RECEIVED', 'registered'], // "Information received"
  ['HANDED_OVER', 'accepted'], // "Handed over"
  ['IN_TRANSIT', 'in_transit'],
  ['OUT_FOR_DELIVERY', 'out_for_delivery'],
  ['DELIVERED', 'delivered'],
  ['EXCEPTION', 'exception'], // "Attention required"
  ['RETURNED', 'returned'], // "Returning"
]);

/** The page's label for each code, which a scan without its own wording is shown with. */
export const WOOLII_LABELS: ReadonlyMap<string, string> = new Map([
  ['UNKNOWN', 'Update pending'], ['INFO_RECEIVED', 'Information received'], ['HANDED_OVER', 'Handed over'],
  ['IN_TRANSIT', 'In transit'], ['OUT_FOR_DELIVERY', 'Out for delivery'], ['DELIVERED', 'Delivered'],
  ['EXCEPTION', 'Attention required'], ['RETURNED', 'Returning'],
]);

/** The stage of a status code; `UNKNOWN` ("Update pending") and codes the page does not list move nothing. */
export function wooliiStage(code: string): Stage | undefined {
  return CODES.get(code.toUpperCase());
}

export const statusMap: CarrierStatusMap = {
  stage: (code) => (code ? wooliiStage(code) : undefined),
  gaps: [{ code: 'UNKNOWN', note: 'The page\'s "Update pending": a status not yet known, which moves nothing.' }],
};
