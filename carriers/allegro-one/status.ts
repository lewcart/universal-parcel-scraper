import type { Stage } from '../../core/status/index.js';
import { normalizeStatusWording, type CarrierStatusMap } from '../../core/status/statusMap.js';

/**
 * The tracker's English status wordings. The service sends no status code, so
 * each scan is staged by its wording. A parcel goes to a One Box locker, a One
 * Punkt pickup point or the recipient's door; the history does not say which.
 */
export const ALLEGRO_ONE_SCANS: Readonly<Record<string, Stage>> = {
  // The sender made the label; Allegro One has not handled the parcel yet.
  'Parcel has been prepared by the sender': 'registered',
  // The sender dropped the parcel in a locker or at a point.
  'Parcel has been dispatched': 'accepted',
  'Parcel has been dispatched at point': 'accepted',
  'Parcel has been picked up by the courier': 'accepted',
  // A courier collected the sender's drop-off from the locker or the point.
  'Parcel has been picked up from parcel locker by courier': 'accepted',
  'Parcel has been picked up from point by courier': 'accepted',
  'Courier has transferred the parcel to the warehouse': 'in_transit',
  'Parcel has been dispatched to its destination point': 'in_transit',
  'Parcel has been accepted at the sorting center': 'in_transit',
  'Dispatched from sorting center': 'in_transit',
  'Parcel has been accepted at the branch': 'in_transit',
  'Parcel has been redirected to a different point': 'in_transit',
  // Notices while the parcel is on its way; neither stops it.
  'Parcel may be delivered with delay': 'in_transit',
  'Parcel delivery time has been arranged with the recipient': 'in_transit',
  'Parcel has been released for delivery': 'out_for_delivery',
  // The courier found the locker full and keeps the parcel.
  'No space in the parcel locker': 'failed_attempt',
  // The recipient is asked to choose another point.
  'Parcel is waiting for an alternative point indication': 'exception',
  'Parcel is awaiting pick-up': 'ready_for_pickup',
  'Parcel is awaiting pick-up — pick-up deadline is about to expire': 'ready_for_pickup',
  'Time for pick-up has been extended': 'ready_for_pickup',
  'Time for parcel pick-up has expired': 'exception',
  // The parcel was not where a scan expected it; a later scan can find it again.
  'No parcel': 'exception',
  'Parcel has been lost': 'exception',
  'Parcel has been returned to the sender': 'returned',
  'Parcel has been delivered': 'delivered',
};

const SCANS = new Map(Object.entries(ALLEGRO_ONE_SCANS).map(([wording, stage]) => [normalizeStatusWording(wording), stage]));

/** The stage a scan's wording gives it, if any. */
export function allegroOneStage(wording: string): Stage | undefined {
  return SCANS.get(normalizeStatusWording(wording));
}

/** The tracker's scans carry a wording and no status code. */
export const statusMap: CarrierStatusMap = {
  stage: (code, wording) => code ? undefined : SCANS.get(wording),
  gaps: [],
};
