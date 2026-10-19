import type { Stage } from '../../core/status/index.js';
import { normalizeStatusWording, type CarrierStatusMap } from '../../core/status/statusMap.js';
import { SUB_STAGES } from '../../providers/seventeentrack/status.js';
import statuses from './statuses.json' with { type: 'json' };

// Rows without a platform code that JCEX's tracker writes as one.
const WORDINGS = new Map<string, Stage>(statuses.entries.filter((entry) => !('code' in entry))
  .map((entry) => [normalizeStatusWording(entry.wording), entry.stage as Stage]));

/**
 * The stage JCEX's map gives a row. JCEX files its scans under 17TRACK's
 * sub-statuses (`platformEventCode`), and the code decides: its own event
 * codes group scans of several stages, and the code keeps its origin
 * warehouse's "Arrive at the delivery point" in transit. A row without a code
 * is read by its wording.
 */
export function jcexStage(code: string | null, wording: string): Stage | undefined {
  if (code) return Object.hasOwn(SUB_STAGES, code) ? SUB_STAGES[code] : undefined;
  return WORDINGS.get(wording);
}

export const statusMap: CarrierStatusMap = { stage: jcexStage, gaps: [] };
