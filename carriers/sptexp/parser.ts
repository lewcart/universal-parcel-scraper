import type { CarrierResult } from '../../core/result/index.js';
import { normalizeHualeiNumber, parseHualeiPage, parseHualeiTrack, type HualeiTenant } from '../gzyl/hualei.js';
import { sptexpStage } from './status.js';

export const PROVIDER = 'SPT Express';
export const SPTEXP_ORIGIN = 'http://106.52.159.115:8082';
export const SPTEXP: HualeiTenant = { carrier: 'sptexp', provider: PROVIDER, origin: SPTEXP_ORIGIN, stage: sptexpStage };

export const normalizeSptexpNumber = (raw: string): string => normalizeHualeiNumber(raw, PROVIDER);
/** The track interface's reply, or null when it holds no row for the number. */
export const parseSptexpTrack = (payload: unknown, number: string, readAt?: number): CarrierResult | null =>
  parseHualeiTrack(payload, number, SPTEXP, readAt);
export const parseSptexpPage = (html: string, number: string, readAt?: number): CarrierResult =>
  parseHualeiPage(html, number, SPTEXP, readAt);
