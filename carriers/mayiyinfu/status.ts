import type { Stage } from '../../core/status/index.js';
import { normalizeStatusWording, type CarrierStatusMap } from '../../core/status/statusMap.js';
import statuses from './statuses.json' with { type: 'json' };

const WORDINGS = new Map<string, Stage>(statuses.entries.map((entry) => [normalizeStatusWording(entry.wording), entry.stage as Stage]));
// A row relayed from the delivery carrier can end with its tracking link in brackets.
const LINK = /\s*\([^()]*https?:\/\/[^()]*\)$/;
// Mayi Yinfu's flight rows lead with the step, then a comma, the day it expects and a translation.
const STEP = /^(\p{Script=Han}+)[，,]/u;

/**
 * The stage Mayi Yinfu's map gives a row, by its `normalizeStatusWording`
 * wording, else by that wording without the partner's link, else by the step
 * it leads with. A row's kind code groups many wordings and decides nothing.
 */
export function mayiyinfuStage(_code: string | null, wording: string): Stage | undefined {
  return WORDINGS.get(wording) ?? WORDINGS.get(wording.replace(LINK, '')) ?? WORDINGS.get(STEP.exec(wording)?.[1] ?? '');
}

export const statusMap: CarrierStatusMap = { stage: mayiyinfuStage, gaps: [] };
