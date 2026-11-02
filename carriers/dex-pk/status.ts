import type { Stage } from '../../core/status/index.js';
import type { CarrierStatusMap } from '../../core/status/statusMap.js';
import statuses from './statuses.json' with { type: 'json' };

const STATUSES = new Map(statuses.entries.map((entry) => [entry.code, { stage: entry.stage as Stage, title: entry.wording }]));
/** Titles come from the official page's code map; a shared title alone gives no stage. */
export function dexPkStatus(code: string): { stage?: Stage; title: string } | undefined {
  return STATUSES.get(code);
}

export const statusMap: CarrierStatusMap = {
  stage: (code) => code ? STATUSES.get(code)?.stage : undefined,
  gaps: [],
};
