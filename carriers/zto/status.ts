import { classifyWording, type ClassifiedWording, type Stage } from '../../core/status/index.js';
import type { CarrierStatusMap } from '../../core/status/statusMap.js';

// The website client's trace types: 已取件 and 已收件 (collected, received), 运输中 (in transit),
// 派件中 (out for delivery), 已代收 (held by a collection point for the recipient), 已签收 (signed for)
// and 异常通知 (exception notice). Returns, redirections and terminations keep their wording.
const CODES = new Map<string, Stage>([['PACKED', 'accepted'], ['RECEIVED', 'accepted'], ['TRANSITING', 'in_transit'],
  ['DISPATCHING', 'out_for_delivery'], ['ARRIVED', 'ready_for_pickup'], ['SIGNED', 'delivered'],
  ['ABNORMAL', 'exception'], ['EXCEPTION', 'exception']]);

export function ztoStage(code: string, wording: string): ClassifiedWording | null {
  const stage = CODES.get(code);
  if (stage) return { stage, source: 'carrier_map' };
  const classified = classifyWording(wording, 'in_transit');
  return classified.source === 'none' ? null : classified;
}

export const statusMap: CarrierStatusMap = { stage: code => code ? CODES.get(code) : undefined, gaps: [] };
