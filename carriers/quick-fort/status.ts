import { classifyWording, type ClassifiedWording } from '../../core/status/index.js';
import type { CarrierStatusMap } from '../../core/status/statusMap.js';

/** Quick Fort's rows have no codes, and the shared classifier reads each sentence, without a fallback stage. */
export function quickFortStage(wording: string): ClassifiedWording | null {
  if (!wording) return null;
  const staged = classifyWording(wording, 'in_transit');
  return staged.source === 'none' ? null : staged;
}

export const statusMap: CarrierStatusMap = { stage: () => undefined, gaps: [] };
