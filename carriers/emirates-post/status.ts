import { classifyWording, type ClassifiedWording, type Stage } from '../../core/status/index.js';
import type { CarrierStatusMap } from '../../core/status/statusMap.js';

const CODES = new Map<string, Stage>([
  ['P-58', 'accepted'], ['P-1', 'in_transit'], ['P-61', 'in_transit'],
  ['P-139', 'customs'], ['P-141', 'in_transit'], ['P-9', 'in_transit'],
  ['P-145', 'exception'], ['P-175', 'in_transit'], ['P-8', 'in_transit'],
  ['P-51', 'ready_for_pickup'], ['P-14', 'out_for_delivery'],
  ['P-53', 'delivered'], ['CLC12', 'delivered'],
]);

export function emiratesPostStage(code: string, description: string): ClassifiedWording | null {
  const stage = CODES.get(code);
  if (stage) return { stage, source: 'carrier_map' };
  const wording = classifyWording(description, 'in_transit');
  return wording.source === 'none' ? null : wording;
}

export const statusMap: CarrierStatusMap = { stage: code => code ? CODES.get(code) : undefined, gaps: [] };
