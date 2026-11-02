import { classifyWording, type ClassifiedWording, type Stage } from '../../core/status/index.js';
import { normalizeStatusWording, type CarrierStatusMap } from '../../core/status/statusMap.js';
import statuses from './statuses.json' with { type: 'json' };

type Entry = { code?: string; wording: string; stage?: string };

// A code ending in `_Other` stands for any scan of its family without a code of its own, so the map
// reads its rows by code and wording together.
const FAMILY = /_Other$/;
const key = (code: string, wording: string): string => (FAMILY.test(code) ? `${code}\n${normalizeStatusWording(wording)}` : code);

/** The stage each scan code seen on Techlink's tracker gives. */
const CODES = new Map<string, Stage>((statuses.entries as readonly Entry[]).filter((entry) => entry.code && entry.stage)
  .map((entry) => [key(entry.code!, entry.wording), entry.stage as Stage]));

/** The stage Techlink's map gives a scan code, and its wording where the code is a family's. */
export function techlinkMappedStage(code: string, wording: string): Stage | undefined {
  return CODES.get(key(code, wording));
}

/** A scan's stage: its code, else the shared wording rules, else none. */
export function techlinkStage(code: string, wording: string): ClassifiedWording | null {
  const mapped = code ? techlinkMappedStage(code, wording) : undefined;
  if (mapped) return { stage: mapped, source: 'carrier_map' };
  const worded = classifyWording(wording, 'in_transit');
  return worded.source === 'none' ? null : worded;
}

/** Every scan carries its code: the map reads it, with the wording only for a family's code. */
export const statusMap: CarrierStatusMap = {
  stage: (code, wording) => (code ? techlinkMappedStage(code, wording) : undefined),
  gaps: [],
};
