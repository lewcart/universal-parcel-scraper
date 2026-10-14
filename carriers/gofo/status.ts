import type { ClassifiedStatus } from '../../core/status/index.js';
import type { CarrierStatusMap } from '../../core/status/statusMap.js';

const CODES = new Map<string, ClassifiedStatus>([
  ['100', { status: 'pending', stage: 'registered' }],
  ...['200', '201', '202', '203', '411', '412', '414'].map(code => [code, { status: 'in_transit', stage: 'in_transit' }] as [string, ClassifiedStatus]),
  ['208', { status: 'out_for_delivery', stage: 'out_for_delivery' }],
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
