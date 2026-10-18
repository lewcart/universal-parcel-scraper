import { classifyWording, languageStageStatus, type ClassifiedStatus, type Stage } from '../../core/status/index.js';
import { normalizeStatusWording, type CarrierStatusMap } from '../../core/status/statusMap.js';

const CODES = new Map<string, ClassifiedStatus>([
  ['FPX_S_OK', { status: 'delivered', stage: 'delivered' }],
  ['FPX_D_SD', { status: 'out_for_delivery', stage: 'out_for_delivery' }],
  ['FPX_D_FD', { status: 'exception', stage: 'failed_attempt' }],
  ['FPX_L_RPIF', { status: 'pending', stage: 'registered' }],
  ['FPX_L_SC', { status: 'in_transit', stage: 'accepted' }],
  ['FPX_C_SPLS', { status: 'in_transit', stage: 'accepted' }],
  ['FPX_C_SPQS', { status: 'in_transit', stage: 'accepted' }],
  ['FPX_C_AAF', { status: 'in_transit', stage: 'in_transit' }],
  ['FPX_C_ADFF', { status: 'in_transit', stage: 'in_transit' }],
  ['FPX_F_ST', { status: 'in_transit', stage: 'in_transit' }],
  ['FPX_M_HA', { status: 'in_transit', stage: 'in_transit' }],
  ['FPX_M_DFOA', { status: 'in_transit', stage: 'in_transit' }],
  ['FPX_M_ATA', { status: 'in_transit', stage: 'in_transit' }],
  ['FPX_M_CRSD', { status: 'in_transit', stage: 'customs' }],
  ['FPX_I_RCUK', { status: 'in_transit', stage: 'in_transit' }],
  ['FPX_D_AOPC', { status: 'in_transit', stage: 'in_transit' }],
  ['FPX_D_STPP', { status: 'in_transit', stage: 'in_transit' }],
  ['FPX_D_HQ', { status: 'in_transit', stage: 'in_transit' }],
  ['FPX_O_RR', { status: 'in_transit', stage: 'in_transit' }],
  ['FPX_M_IT', { status: 'in_transit', stage: 'in_transit' }],
]);
// These codes relay whatever step a partner reported, from a label to an
// arrival in the destination country, so the wording decides the stage.
const WORDED = new Set(['FPX_O_IR', 'FPX_O_IRI']);
// By `normalizeStatusWording` wording. A partner's label can name its own
// waybill: "Waybill generated for …", as Emile words it.
const WORDING: ReadonlyMap<string, Stage> = new Map([['waybill generated', 'registered']]);
const LABEL_FOR = /^waybill generated for [a-z0-9]+$/;
// Scans a partner relays without a code, by `normalizeStatusWording` wording.
const UNCODED: ReadonlyMap<string, Stage> = new Map([
  ['your shipment has departed from the transit origin', 'in_transit'],
  ['your shipment has arrived at the transit destination', 'in_transit'],
]);

export interface FourPxStatus extends ClassifiedStatus {
  source: string;
}

export function fourPxStatus(code: string, description = ''): FourPxStatus | undefined {
  const mapped = CODES.get(code);
  if (mapped) return { ...mapped, source: 'carrier_map' };
  const uncoded = code ? undefined : UNCODED.get(normalizeStatusWording(description));
  if (uncoded) return { status: languageStageStatus(uncoded), stage: uncoded, source: 'carrier_map' };
  if (!WORDED.has(code)) return undefined;
  const exact = wordedStage(normalizeStatusWording(description));
  if (exact) return { status: languageStageStatus(exact), stage: exact, source: 'carrier_map' };
  const worded = classifyWording(description, 'pending');
  return worded.source === 'none' ? undefined : { status: languageStageStatus(worded.stage), stage: worded.stage, source: worded.source };
}

function wordedStage(wording: string): Stage | undefined {
  return WORDING.get(wording) ?? (LABEL_FOR.test(wording) ? 'registered' : undefined);
}

/**
 * What the map says about one scan: a code it maps, the known wording of a
 * code that relays a partner's step, or a codeless scan it knows. Other
 * wording under those codes is left to the shared rules.
 */
export const statusMap: CarrierStatusMap = {
  stage: (code, wording) => {
    if (!code) return UNCODED.get(wording);
    return CODES.get(code)?.stage ?? (WORDED.has(code) ? wordedStage(wording) : undefined);
  },
  gaps: [],
};
