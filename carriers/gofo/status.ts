import type { ClassifiedStatus } from '../../core/status/index.js';
import type { CarrierStatusMap } from '../../core/status/statusMap.js';

const CODES = new Map<string, ClassifiedStatus>([
  ['100', { status: 'pending', stage: 'registered' }],
  // The label voided after it was created: no parcel is coming under the number.
  ['101', { status: 'exception', stage: 'exception' }],
  // A pickup exception: GOFO has not received the parcel from the sender's warehouse yet.
  ['802', { status: 'pending', stage: 'registered' }],
  // GOFO's driver has set out to collect the parcel from the sender, then has it.
  ['216', { status: 'pending', stage: 'registered' }],
  ['801', { status: 'in_transit', stage: 'accepted' }],
  ...['200', '201', '202', '203', '411', '412', '414', '612', '810'].map(code => [code, { status: 'in_transit', stage: 'in_transit' }] as [string, ClassifiedStatus]),
  ['208', { status: 'out_for_delivery', stage: 'out_for_delivery' }],
  // A delivery attempt that failed, whatever reason follows the comma.
  ['206', { status: 'exception', stage: 'failed_attempt' }],
  ['205', { status: 'delivered', stage: 'delivered' }],
]);

export function gofoStatus(code: string): ClassifiedStatus | undefined { return CODES.get(code); }

/** By code; the parser refuses a delivery code whose wording is not a delivery. */
export const statusMap: CarrierStatusMap = {
  stage: (code, wording) => {
    const stage = code ? gofoStatus(code)?.stage : undefined;
    return stage === 'delivered' && !/^delivered(?:,|$)/.test(wording) ? undefined : stage;
  },
  gaps: [],
};
