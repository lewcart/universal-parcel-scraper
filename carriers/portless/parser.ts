import { carrierIdFromPartner } from '../../core/catalog/hints.js';
import { detectCarrierMatch, normalizeTrackingNumber } from '../../core/detection/index.js';
import { IndeterminateError, InvalidInputError, NoHistoryError, NotFoundError, SchemaError } from '../../core/errors/index.js';
import type { CarrierEvent, CarrierResult } from '../../core/result/index.js';
import { languageStageStatus, type Stage } from '../../core/status/index.js';
import { clean } from '../../core/transport/index.js';
import { isRecord } from '../../core/types.js';
import { portlessStage } from './status.js';

export const PROVIDER = 'Portless';
export const CARRIER = 'portless';
// A reply is a few kilobytes.
export const PORTLESS_MAX_BYTES = 256 * 1024;

// Portless tracks a parcel under its delivery carrier's number.
const NUMBER = /^(?=.*\d)[A-Z0-9]{8,40}$/;
const MAX_EVENTS = 300;
// An instant with its offset, as every checkpoint states it.
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;
// A status and its sub-status, `InTransit_002`, or the status alone.
const CODE = /^[A-Za-z]+(?:_\d{3})?$/;
// A day the page shows as the estimate, alone or at the start of a date and time.
const DAY = /^(\d{4}-\d{2}-\d{2})(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;
// AfterShip's answer for a number the tracking page does not hold.
const NOT_FOUND = 40414;
const FINAL = new Set<Stage>(['delivered', 'returned']);

/** A delivery carrier's number, as Portless tracks it: eight to forty letters and digits, with a digit. */
export function normalizePortlessNumber(raw: string): string {
  const number = typeof raw === 'string' && raw.length <= 64 ? normalizeTrackingNumber(raw) : '';
  if (!NUMBER.test(number)) throw new InvalidInputError(PROVIDER, 'Portless numbers are eight to forty letters and digits');
  return number;
}

const text = (value: unknown, max: number): string => (typeof value === 'string' && value.length <= max * 4 ? clean(value, max) : '');

/** One checkpoint: its instant as stated, its wording, its place and its AfterShip sub-status. */
function scanOf(value: unknown): CarrierEvent {
  if (!isRecord(value)) throw new SchemaError(PROVIDER, 'Portless returned an invalid checkpoint');
  const time = typeof value.checkpoint_time === 'string' ? value.checkpoint_time.trim() : '';
  const description = text(value.message, 300);
  const code = text(value.sub_status, 40) || text(value.status, 40);
  if (!INSTANT.test(time) || !Number.isFinite(Date.parse(time)) || !description || (code && !CODE.test(code))) {
    throw new SchemaError(PROVIDER, 'Portless returned an invalid checkpoint');
  }
  const location = text(value.location, 120) || [text(value.city, 60), text(value.state, 60)].filter(Boolean).join(', ');
  const stage = portlessStage(code || null, description);
  return { time, description, ...(location ? { location } : {}), ...(code ? { provider_code: code } : {}),
    ...(stage ? { stage: stage.stage, stage_source: stage.source } : {}) };
}

/** The delivery window the page shows: one day, or the first and last days of a range. */
function estimate(value: unknown): Pick<CarrierResult, 'expected_delivery' | 'expected_delivery_from'> {
  if (!isRecord(value)) return { expected_delivery: null };
  const day = (field: unknown) => (typeof field === 'string' ? DAY.exec(field.trim())?.[1] : undefined);
  const exact = day(value.specific_datetime);
  if (exact) return { expected_delivery: exact };
  const [from, to] = [day(value.min_datetime), day(value.max_datetime)];
  if (!to || (from && from > to)) return { expected_delivery: null };
  return { expected_delivery: to, ...(from && from < to ? { expected_delivery_from: from } : {}) };
}

/**
 * The carrier the page names for the last mile, when the catalog knows it by its name and
 * tracking link and its rules offer the number it gives. That number is the delivery number
 * when it is not the one asked.
 */
function lastMile(value: unknown, number: string): Pick<CarrierResult, 'delivery_carrier' | 'delivery_tracking_number'> {
  const leg = isRecord(value) && isRecord(value.last_mile) ? value.last_mile : undefined;
  if (!leg || !isRecord(leg.carrier)) return {};
  const delivery = normalizeTrackingNumber(text(leg.tracking_number, 40));
  const link = text(leg.tracking_url, 300);
  const partner = carrierIdFromPartner(text(leg.carrier.name, 80), /^https:\/\//.test(link) ? link : '');
  if (!partner || partner === CARRIER || !NUMBER.test(delivery)) return {};
  if (!(detectCarrierMatch(delivery).candidates as string[]).includes(partner)) return {};
  return { delivery_carrier: partner, ...(delivery !== number ? { delivery_tracking_number: delivery } : {}) };
}

/**
 * Portless's tracking page's own lookup, `trackings.getTrackingWithTrackingNumber`, answers
 * `{ result: { data: { tracking } } }`: the number, the checkpoints of every leg, oldest
 * first, each an instant with its offset, a wording and an AfterShip sub-status, the delivery
 * window the page shows and the carriers of the first and last miles. A number the page does
 * not hold gets `{ result: { data: { errorCode: 40414 } } }`. The number must be the one
 * asked. The summary status is not read; the checkpoints decide.
 */
export function parsePortless(payload: unknown, raw: string): CarrierResult {
  const number = normalizePortlessNumber(raw);
  const data = isRecord(payload) && isRecord(payload.result) ? payload.result.data : undefined;
  if (!isRecord(data)) throw new SchemaError(PROVIDER, 'Portless returned an invalid reply');
  if (data.tracking === undefined && data.errorCode === NOT_FOUND) throw new NotFoundError(PROVIDER);
  if (data.tracking === undefined && data.errorCode !== undefined) {
    throw new IndeterminateError(PROVIDER, 'Portless could not answer for the number');
  }
  const tracking = data.tracking;
  if (!isRecord(tracking) || !Array.isArray(tracking.checkpoints) || tracking.checkpoints.length > MAX_EVENTS) {
    throw new SchemaError(PROVIDER, 'Portless returned an invalid tracking');
  }
  const shown = typeof tracking.tracking_number === 'string' && tracking.tracking_number.length <= 64
    ? normalizeTrackingNumber(tracking.tracking_number) : '';
  if (!shown) throw new SchemaError(PROVIDER, 'Portless returned a tracking without the number asked');
  if (shown !== number) throw new IndeterminateError(PROVIDER, 'Portless answered for another number');
  // The page lists checkpoints oldest first, so of one instant the later listed is the newer.
  const events = tracking.checkpoints.map(scanOf).map((event, index) => ({ event, index }))
    .sort((a, b) => Date.parse(b.event.time!) - Date.parse(a.event.time!) || b.index - a.index).map(({ event }) => event);
  const newest = events[0];
  if (!newest) throw new NoHistoryError(PROVIDER, 'Portless has no checkpoints for the shipment yet');
  const current = events.find((event) => event.stage);
  const stage = current?.stage as Stage | undefined;
  return {
    status: stage ? languageStageStatus(stage) : 'unknown',
    ...(stage ? { current_stage: stage, current_stage_source: current!.stage_source! } : {}),
    last_status_text: newest.description!,
    last_update: newest.time!,
    ...(stage && FINAL.has(stage) ? { expected_delivery: null } : estimate(tracking.latest_estimated_delivery)),
    ...lastMile(tracking.multiple_fulfilled_carriers, number),
    events,
  };
}
