/**
 * JD Logistics international operation codes (`operationCode`), as the
 * international feed sends them on each scan. Codes not listed here leave the
 * scan to the steps JD relays from a last-mile partner, then to the shared
 * wording rules.
 */
import type { ClassifiedStatus } from '../../core/status/index.js';
import type { CarrierStatusMap } from '../../core/status/statusMap.js';

const MOVING: ClassifiedStatus = { status: 'in_transit', stage: 'in_transit' };
// JD's own warehouse holds the goods while it picks and weighs the order.
const IN_WAREHOUSE: ClassifiedStatus = { status: 'in_transit', stage: 'accepted' };

const CODES = new Map<string, ClassifiedStatus>([
  ['COSH', { status: 'pending', stage: 'registered' }],
  ['3041', IN_WAREHOUSE],
  ['3043', IN_WAREHOUSE],
  ['3052', MOVING],
  // Handed to the last-mile partner, whose first scan follows under DMPU.
  ['1060', MOVING],
  ['DMPU', MOVING],
  ['CCL', { status: 'in_transit', stage: 'customs' }],
  // Clearance completed: the parcel moves on.
  ['CXCCRS', MOVING],
  ['DMSCR', MOVING],
  ['SCVS', MOVING],
  ['VUVU', MOVING],
  ['DMLMLS', { status: 'out_for_delivery', stage: 'out_for_delivery' }],
  ['DLV', { status: 'delivered', stage: 'delivered' }],
]);

// A last-mile partner's step under a code JD has shown only with it, such as GOFO's label
// under SRRF3P. The wording decides, so another step under the same code is not misread.
const RELAYED = new Map<string, ClassifiedStatus>([
  ['shipping label created', { status: 'pending', stage: 'registered' }],
]);

/** The status and stage for one scan's operation code, or its relayed wording; undefined when unmapped. */
export function jdLogisticsStatus(code: string | undefined, wording: string): ClassifiedStatus | undefined {
  return (code ? CODES.get(code) : undefined) ?? RELAYED.get(wording.trim().toLowerCase());
}

/**
 * What the map says about one scan: its operation code, else the wording JD relays from a
 * last-mile partner. A scan the shared wording rules staged stays open.
 */
export const statusMap: CarrierStatusMap = {
  stage: (code, wording) => jdLogisticsStatus(code ?? undefined, wording)?.stage,
  gaps: [],
};
