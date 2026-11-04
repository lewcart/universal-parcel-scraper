import { classifyWording, type ClassifiedWording, type Stage } from '../../core/status/index.js';
import { normalizeStatusWording, type CarrierStatusMap } from '../../core/status/statusMap.js';
import statuses from './statuses.json' with { type: 'json' };

const key = (code: string | null, wording: string) => JSON.stringify([code, wording]);
// The rows seen, by their sub-status and `normalizeStatusWording` wording.
const ROWS = new Map<string, Stage>((statuses.entries as readonly { code?: string; wording: string; stage: string }[])
  .map((entry) => [key(entry.code ?? null, normalizeStatusWording(entry.wording)), entry.stage as Stage]));

const repeat = (prefix: string, numbers: readonly number[], stage: Stage) =>
  numbers.map((number) => [`${prefix}_${String(number).padStart(3, '0')}`, stage] as const);

/**
 * AfterShip's published sub-statuses, which the tracking page files every checkpoint under.
 * A drop-off for collection, a recipient contacted and a booked delivery appointment are left
 * to their wording: none says where the parcel is.
 */
const SUB_STAGES: Readonly<Record<string, Stage>> = Object.fromEntries([
  ['Pending_003', 'registered'],
  ['InfoReceived_001', 'registered'],
  ['InTransit_002', 'accepted'],
  ...repeat('InTransit', [1, 3, 4, 5, 7, 8, 9, 11], 'in_transit'),
  ...repeat('InTransit', [6, 12], 'customs'),
  ['OutForDelivery_001', 'out_for_delivery'],
  ['AvailableForPickup_001', 'ready_for_pickup'],
  ...repeat('AttemptFail', [1, 2, 3], 'failed_attempt'),
  ...repeat('Delivered', [1, 2, 3, 4, 5], 'delivered'),
  ...repeat('Exception', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 14, 16, 17, 18, 19, 20, 21], 'exception'),
  ['Exception_011', 'returned'],
]);

/**
 * A checkpoint's stage. The sub-status decides where it is specific, with 17TRACK's
 * safeguards: generic transit yields to any reading of the wording, a delivery code to
 * wording that reads as another stage, a delivery round to wording that reads as delivered,
 * and a customs code to wording that says customs is done. Otherwise the shared wording
 * rules decide.
 */
export function portlessStage(code: string | null, wording: string): ClassifiedWording | null {
  const seen = ROWS.get(key(code, normalizeStatusWording(wording)));
  if (seen) return { stage: seen, source: 'carrier_map' };
  const worded = classifyWording(wording, 'pending');
  const read = worded.source === 'none' ? undefined : worded.stage;
  const mapped = code && Object.hasOwn(SUB_STAGES, code) ? SUB_STAGES[code] : undefined;
  const yields = !mapped || (code === 'InTransit_001' && read)
    || (mapped === 'delivered' && read && read !== 'delivered')
    || (mapped === 'out_for_delivery' && read === 'delivered')
    || (mapped === 'customs' && read && read !== 'customs');
  if (mapped && !yields) return { stage: mapped, source: 'carrier_map' };
  return read ? worded : null;
}

const NOTHING = 'An AfterShip status that says nothing of where the parcel is.';

export const statusMap: CarrierStatusMap = {
  stage: (code, wording) => {
    const staged = portlessStage(code, wording);
    return staged?.source === 'carrier_map' ? staged.stage : undefined;
  },
  gaps: ['Pending_001', 'Pending_002', 'Pending_004', 'Pending_005', 'Pending_006', 'Expired_001'].map((code) => ({ code, note: NOTHING })),
};
