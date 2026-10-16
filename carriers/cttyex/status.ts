import { classifyWording, type ClassifiedWording, type Stage } from '../../core/status/index.js';
import { normalizeStatusWording, type CarrierStatusMap } from '../../core/status/statusMap.js';

/**
 * CTTYEX's scans, in the English its tracker writes them. Each is one of
 * CTTYEX's own steps in China, from the order data to the flight out. The
 * tracker shows no codes.
 */
const SCANS: ReadonlyMap<string, Stage> = new Map<string, Stage>([
  ['order information received', 'registered'], // The shipment data has arrived; CTTYEX does not hold the parcel yet.
  ['arrive at the cross border receiving point', 'accepted'], // Received at the cross-border receiving point in China.
  ['goods leave the operation center', 'in_transit'],
  ['arrival at domestic internationality airport', 'in_transit'], // At the departure airport in China.
  ['departure from the airport of origin domestic', 'in_transit'], // The flight has left China.
]);

/** The summary's status over the scans, in Chinese, or in English when the tracker is asked in English. */
const SUMMARIES: ReadonlyMap<string, Stage> = new Map<string, Stage>([
  ['运输途中', 'in_transit'],
  ['in transit', 'in_transit'],
]);

/** The tracker's status for a number it does not know, in Chinese and in English. */
export const CTTYEX_NOT_FOUND: readonly string[] = ['查询不到', 'Not Found'];

/** Whether a scan's wording is one of CTTYEX's own steps in China. */
export function cttyexChinaStep(wording: string): boolean {
  return SCANS.has(normalizeStatusWording(wording));
}

/** The stage CTTYEX's wording gives a scan or the summary. */
export function cttyexMappedStage(wording: string): Stage | undefined {
  const key = normalizeStatusWording(wording);
  return SCANS.get(key) ?? SUMMARIES.get(key);
}

/** A scan's stage: the map, else the shared wording rules, else nothing. */
export function cttyexStage(wording: string): ClassifiedWording | null {
  const mapped = cttyexMappedStage(wording);
  if (mapped) return { stage: mapped, source: 'carrier_map' };
  const worded = classifyWording(wording, 'in_transit');
  return worded.source === 'none' ? null : worded;
}

/** What the map says about one scan or summary, by its wording: the tracker shows no codes. */
export const statusMap: CarrierStatusMap = {
  stage: (code, wording) => (code ? undefined : cttyexMappedStage(wording)),
  gaps: CTTYEX_NOT_FOUND.map((wording) => ({ wording: normalizeStatusWording(wording),
    note: 'The tracker\'s status for a number it does not know, which the adapter reads as not found; never a scan.' })),
};
