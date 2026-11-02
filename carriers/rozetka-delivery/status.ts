import type { Stage } from '../../core/status/index.js';
import type { CarrierStatusMap } from '../../core/status/statusMap.js';

// The anonymous track-status dictionary groups these codes by the parcel's
// actual movement. Return movements stay returns, including arrival at the
// sender's branch; they never become recipient delivery or collection.
const STAGES: Readonly<Record<string, Stage>> = {
  '10010': 'registered', '10020': 'registered',
  '10028': 'accepted', '10029': 'exception', '10030': 'accepted',
  '10040': 'in_transit', '10050': 'in_transit', '10070': 'in_transit',
  '20010': 'in_transit', '20020': 'in_transit', '20030': 'in_transit',
  '30010': 'in_transit', '40041': 'in_transit',
  '10060': 'exception', '60010': 'exception', '10080': 'exception',
  '40030': 'in_transit', '40040': 'ready_for_pickup', '40080': 'ready_for_pickup',
  '40045': 'failed_attempt', '40050': 'exception', '40060': 'returned', '40070': 'exception',
  '50010': 'returned', '50011': 'returned', '50012': 'returned', '50013': 'returned',
  '50015': 'returned', '50021': 'returned', '50030': 'returned', '50020': 'returned',
  '60030': 'delivered', '60040': 'returned',
};

/** Only the carrier's own codes stage its scans; unfamiliar codes remain visible. */
export function rozetkaStage(code: string): Stage | undefined {
  return Object.hasOwn(STAGES, code) ? STAGES[code] : undefined;
}

export const statusMap: CarrierStatusMap = {
  stage: code => code ? rozetkaStage(code) : undefined,
  gaps: [{ code: '60025', note: 'Partial receipt does not establish delivery of the whole parcel.' }],
};
