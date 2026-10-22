/**
 * InPost status vocabulary for the public inposteasy.com hub.
 *
 * Codes are `<PHASE>.<NNNN>` strings (CRE creation, FMD first mile, MMD middle
 * mile, LMD last mile, RTS return to sender, EOL end of life). The
 * cross-border vocabulary is explicitly still being observed, so an unmapped
 * code yields no stage at all: the event keeps its raw wording, the result
 * reports `unknown`, and the sync classifies and records it.
 *
 * Provenance: derived from the prior-art client
 * https://github.com/ha-parcel-integrations/ha-inpost (MIT,
 * `TRACKING_STATUS_MAP`), live-confirmed on IT/PT/GB consignments 2026-08-31.
 */
import type { ClassifiedStatus } from '../../core/status/index.js';

const TRACKING_STATUS: Record<string, ClassifiedStatus> = {
  // Creation and handover: the sender posts the parcel at a locker or pickup
  // point, or a courier collects it.
  'CRE.1001': { status: 'pending', stage: 'registered' },
  'FMD.1001': { status: 'in_transit', stage: 'accepted' },
  'FMD.1002': { status: 'in_transit', stage: 'accepted' },
  // Logistics-centre movement.
  'MMD.1001': { status: 'in_transit', stage: 'in_transit' },
  'MMD.1002': { status: 'in_transit', stage: 'in_transit' },
  'MMD.1003': { status: 'in_transit', stage: 'in_transit' },
  'MMD.1004': { status: 'in_transit', stage: 'in_transit' },
  // Last-mile, redirects and collection. LMD.1001 hands the parcel to the
  // courier for delivery, to the door or to a locker.
  'LMD.1001': { status: 'out_for_delivery', stage: 'out_for_delivery' },
  'LMD.1002': { status: 'in_transit', stage: 'in_transit' },
  'LMD.3006': { status: 'in_transit', stage: 'in_transit' },
  'LMD.3014': { status: 'in_transit', stage: 'in_transit' },
  'LMD.1004': { status: 'out_for_delivery', stage: 'ready_for_pickup' },
  'LMD.1005': { status: 'out_for_delivery', stage: 'ready_for_pickup' },
  'LMD.9001': { status: 'out_for_delivery', stage: 'ready_for_pickup' },
  'LMD.9002': { status: 'exception', stage: 'failed_attempt' },
  // The recipient refused the parcel.
  'LMD.9006': { status: 'exception', stage: 'failed_attempt' },
  'LMD.9014': { status: 'exception', stage: 'returned' },
  // Terminal outcomes.
  'EOL.1001': { status: 'delivered', stage: 'delivered' },
  'EOL.1003': { status: 'delivered', stage: 'delivered' },
  'EOL.9001': { status: 'exception', stage: 'failed_attempt' },
  'RTS.1001': { status: 'exception', stage: 'returned' },
  'RTS.1002': { status: 'exception', stage: 'returned' },
};

/**
 * Codes that say nothing of how far the parcel got, so they keep the stage of
 * the event before it. LMD.3013 ("Paczka przekierowana") changes where it goes
 * and comes straight after creation as well as later; INF.9001 ("Possible
 * delivery delay") is a notice between two moves.
 */
const STAGE_KEEPERS = new Set(['LMD.3013', 'INF.9001']);

/** Whether an InPost hub status code keeps the stage the parcel had before it. */
export function keepsInpostStage(code: string): boolean {
  return STAGE_KEEPERS.has(code);
}

/** The stage and status for an InPost hub status code, or undefined when unmapped. */
export function classifyInpostStatus(code: string): ClassifiedStatus | undefined {
  return TRACKING_STATUS[code];
}
