import { classifyWording, type ClassifiedWording, type Stage } from '../../core/status/index.js';
import { normalizeStatusWording, type CarrierStatusMap } from '../../core/status/statusMap.js';

/** A wording as the map keys it: normalized, without a closing full stop. */
const key = (wording: string) => normalizeStatusWording(wording).replace(/[\s.。]+$/u, '');

/**
 * The tracker's scans carry no code, only a sentence. Those seen in replies are
 * mapped, in English and in the Chinese the tracker answers other languages
 * with; other wording falls to the shared rules.
 */
const WORDINGS: ReadonlyMap<string, Stage> = new Map(([
  // J&T collected an imported parcel from the customs broker; the shared rules would read it as held by customs.
  ['The parcel has been picked up from customs clearance.', 'accepted'],
  ['包裹已从清关行取件。', 'accepted'],
  ['The parcel has been successfully picked up and is being prepared for transportation.', 'accepted'],
  ['快件已揽收成功，运输准备中。', 'accepted'],
  ['The parcel arrives at the distribution center and is prepared for transport to the next destination.', 'in_transit'],
  ['快件到达转运中心，做发往下一站的运输准备', 'in_transit'],
  ['The parcel is dispatched from the transit center to the next destination', 'in_transit'],
  ['快件从转运中心发往下一站', 'in_transit'],
  ['Your parcel is out for delivery. If you have any questions, please call, Thank you for your patience.', 'out_for_delivery'],
  ['Your parcel has been delivered.If you have any questions,please call. We look forward to serving you again.', 'delivered'],
] as const).map(([wording, stage]) => [key(wording), stage]));

/** The stage the map gives a scan's wording. */
export function jAndTAuMappedStage(wording: string): Stage | undefined {
  return WORDINGS.get(key(wording));
}

/** A scan's stage: its wording in the map, else the shared wording rules, else nothing. */
export function jAndTAuStage(wording: string): ClassifiedWording | null {
  const mapped = jAndTAuMappedStage(wording);
  if (mapped) return { stage: mapped, source: 'carrier_map' };
  const worded = classifyWording(wording, 'in_transit');
  return worded.source === 'none' ? null : worded;
}

export const statusMap: CarrierStatusMap = {
  stage: (_code, wording) => jAndTAuMappedStage(wording),
  gaps: [],
};
