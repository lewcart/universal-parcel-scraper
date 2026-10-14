import type { CarrierResult } from '../../core/result/index.js';
import { normalizeHualeiNumber, parseHualeiPage, parseHualeiTrack, type HualeiTenant } from './hualei.js';
import { gzylStage } from './status.js';

export const PROVIDER = 'GZYL';
export const GZYL_ORIGIN = 'http://134.175.243.207:8082';
export const GZYL: HualeiTenant = { carrier: 'gzyl', provider: PROVIDER, origin: GZYL_ORIGIN, stage: gzylStage };

export const normalizeGzylNumber = (raw: string): string => normalizeHualeiNumber(raw, PROVIDER);
/** The track interface's reply, or null when it holds no row for the number. */
export const parseGzylTrack = (payload: unknown, number: string, readAt?: number): CarrierResult | null =>
  parseHualeiTrack(payload, number, GZYL, readAt);
export const parseGzylPage = (html: string, number: string, readAt?: number): CarrierResult =>
  parseHualeiPage(html, number, GZYL, readAt);
