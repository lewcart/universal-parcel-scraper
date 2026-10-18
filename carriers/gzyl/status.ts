import type { Stage } from '../../core/status/index.js';
import { normalizeStatusWording, type CarrierStatusMap } from '../../core/status/statusMap.js';
import statuses from './statuses.json' with { type: 'json' };

const WORDINGS = new Map<string, Stage>(statuses.entries.map((entry) => [normalizeStatusWording(entry.wording), entry.stage as Stage]));

const PLACE = '<place>';
// A wording ending in `<place>` stands for every town GZYL writes into its end.
const PLACED = statuses.entries.filter((entry) => entry.wording.endsWith(PLACE))
  .map((entry) => [`${normalizeStatusWording(entry.wording.slice(0, -PLACE.length))} `, entry.stage as Stage] as const);

/**
 * The stage GZYL's map gives a row, by its `normalizeStatusWording` wording.
 * A row's kind code, when it has one, groups many wordings and decides nothing.
 */
export function gzylStage(_code: string | null, wording: string): Stage | undefined {
  return WORDINGS.get(wording) ?? PLACED.find(([prefix]) => wording.startsWith(prefix))?.[1];
}

export const statusMap: CarrierStatusMap = { stage: gzylStage, gaps: [] };
