import { classifyWording, type ClassifiedWording } from '../../core/status/index.js';
import type { CarrierStatusMap } from '../../core/status/statusMap.js';

/** No WP Ground wording has been seen yet: the shared classifier reads each, without a fallback stage. */
export function wpGroundStage(wording: string): ClassifiedWording | null {
  if (!wording) return null;
  const staged = classifyWording(wording, 'in_transit');
  return staged.source === 'none' ? null : staged;
}

export const statusMap: CarrierStatusMap = { stage: () => undefined, gaps: [] };
