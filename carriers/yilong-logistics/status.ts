import type { Stage } from '../../core/status/index.js';
import { normalizeStatusWording, type CarrierStatusMap } from '../../core/status/statusMap.js';
import statuses from './statuses.json' with { type: 'json' };

const WORDINGS = new Map<string, Stage>(statuses.entries.map((entry) => [normalizeStatusWording(entry.wording), entry.stage as Stage]));
// The last-mile carrier's failed attempt, which goes on with the driver's note.
const FAILED_ATTEMPT = /^delivery failed\b/;

/**
 * The stage Yilong Logistics' map gives a row, by its `normalizeStatusWording` wording.
 * A row's kind code, when it has one, groups many wordings and decides nothing.
 */
export function yilongStage(_code: string | null, wording: string): Stage | undefined {
  return WORDINGS.get(wording) ?? (FAILED_ATTEMPT.test(wording) ? 'failed_attempt' : undefined);
}

export const statusMap: CarrierStatusMap = { stage: yilongStage, gaps: [] };
