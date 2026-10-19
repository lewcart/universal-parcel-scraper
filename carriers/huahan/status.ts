import { classifyWording, type ClassifiedWording, type Stage } from '../../core/status/index.js';
import type { CarrierStatusMap } from '../../core/status/statusMap.js';

// The origin milestone codes are documented by getCargoTrack. PB is the web
// tracker's partner scan for arrival at the delivery point, ready for collection.
const CODES: ReadonlyMap<string, Stage> = new Map([
  ['IR', 'registered'], ['AF', 'accepted'], ['DF', 'in_transit'], ['PB', 'ready_for_pickup'],
]);

export function huahanStage(code: string, wording: string): ClassifiedWording | null {
  const stage = CODES.get(code);
  if (stage) return { stage, source: 'carrier_map' };
  const classified = classifyWording(wording, 'pending');
  return classified.source === 'none' ? null : classified;
}

export const statusMap: CarrierStatusMap = { stage: code => CODES.get(code ?? ''), gaps: [] };
