import type { CarrierResult } from '../../core/result/index.js';
import { normalizeHualeiNumber, parseHualeiPage, parseHualeiTrack, type HualeiTenant } from '../gzyl/hualei.js';
import { mayiyinfuStage } from './status.js';

export const PROVIDER = 'Mayi Yinfu';
export const MAYIYINFU_ORIGIN = 'http://www.mayiyinfu.com.cn:8082';
export const MAYIYINFU: HualeiTenant = { carrier: 'mayiyinfu', provider: PROVIDER, origin: MAYIYINFU_ORIGIN, stage: mayiyinfuStage };

export const normalizeMayiyinfuNumber = (raw: string): string => normalizeHualeiNumber(raw, PROVIDER);
/** The track interface's reply, or null when it holds no row for the number. */
export const parseMayiyinfuTrack = (payload: unknown, number: string, readAt?: number): CarrierResult | null =>
  parseHualeiTrack(payload, number, MAYIYINFU, readAt);
export const parseMayiyinfuPage = (html: string, number: string, readAt?: number): CarrierResult =>
  parseHualeiPage(html, number, MAYIYINFU, readAt);
