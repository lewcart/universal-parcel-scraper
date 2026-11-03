import { normalizeTrackingNumber } from '../../core/detection/index.js';
import { InvalidInputError } from '../../core/errors/index.js';
import type { CarrierResult } from '../../core/result/index.js';
import { parseTrackingByNos, type TrackingByNosCarrier } from '../cttyex/parser.js';
import { LIUCHEN_NOT_FOUND, liuchenMappedStage, liuchenStage } from './status.js';

export const PROVIDER = 'Liuchen';
// One parcel's reply is about a kilobyte.
export const LIUCHEN_MAX_BYTES = 256 * 1024;
// No public page shows a Liuchen number, so the rule is the system's: letters and digits, one digit at least.
const NUMBER = /^(?=[A-Z]*\d)[A-Z0-9]{8,40}$/;

/** A number for Liuchen's tracker, in capitals. */
export function normalizeLiuchenNumber(raw: string): string {
  const number = typeof raw === 'string' && raw.length <= 64 ? normalizeTrackingNumber(raw).toUpperCase() : '';
  if (!NUMBER.test(number)) throw new InvalidInputError(PROVIDER, 'Liuchen numbers are eight or more letters and digits');
  return number;
}

const LIUCHEN: TrackingByNosCarrier = { provider: PROVIDER, normalize: normalizeLiuchenNumber, stage: liuchenStage,
  summaryStage: liuchenMappedStage, notFound: LIUCHEN_NOT_FOUND };

/** Liuchen's reply for one number, which its tracker, CTTYEX's system, gives in CTTYEX's form. */
export const parseLiuchen = (payload: unknown, raw: string): CarrierResult => parseTrackingByNos(payload, raw, LIUCHEN);
