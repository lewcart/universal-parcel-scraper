import { normalizeTrackingNumber } from '../../core/detection/index.js';
import { IndeterminateError, InvalidInputError, NoHistoryError, SchemaError } from '../../core/errors/index.js';
import type { CarrierEvent, CarrierResult } from '../../core/result/index.js';
import { languageStageStatus, type Stage } from '../../core/status/index.js';
import { explicitOffsetTime } from '../../core/time/index.js';
import { clean } from '../../core/transport/text.js';
import { logisticsSolutionStage } from './status.js';

export const PROVIDER = 'Logistics Solution';

/** Logistics Solution publishes no number format; its tracker asks for six characters or more. */
export function logisticsSolutionNumber(raw: string): string {
  const number = typeof raw === 'string' && raw.length <= 64 ? normalizeTrackingNumber(raw) : '';
  if (/^[A-Z0-9]{6,40}$/.test(number)) return number;
  throw new InvalidInputError(PROVIDER, 'Logistics Solution tracking takes one number of 6 to 40 letters and digits');
}

type Row = Record<string, unknown>;
const isRow = (value: unknown): value is Row => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown, limit: number) => (typeof value === 'string' ? clean(value, limit) : '');

/** A place without a postcode; one that still holds a number is an address, and is left out. */
function placeOf(value: unknown): string | undefined {
  const place = text(value, 200).replace(/\b\d{4,6}\b/g, ' ')
    .replace(/\s*,\s*(?=,|$)/g, '').replace(/\s+/g, ' ').replace(/^[\s,]+|[\s,]+$/g, '');
  return place && !/\d/.test(place) ? place : undefined;
}

/**
 * The tracker's answer to `/api/tracking` for one number: a list whose first entry is the parcel,
 * with its events. The sender's and recipient's names, the carrier's name and weights are never read.
 */
export function parseLogisticsSolution(body: unknown, raw: string): CarrierResult {
  const number = logisticsSolutionNumber(raw);
  if (!Array.isArray(body) || body.length > 20) throw new SchemaError(PROVIDER, 'Logistics Solution returned no parcel list');
  // The page shows an empty list as no information, not as a missing parcel.
  if (!body.length) throw new IndeterminateError(PROVIDER, 'Logistics Solution answered without a parcel');
  const parcel: unknown = body[0];
  if (!isRow(parcel)) throw new SchemaError(PROVIDER, 'Logistics Solution returned no parcel');
  const named = typeof parcel.parcelNr === 'string' ? normalizeTrackingNumber(parcel.parcelNr.slice(0, 64)) : '';
  if (named !== number) throw new IndeterminateError(PROVIDER, 'Logistics Solution answered without the number asked');
  if (parcel.events !== undefined && parcel.events !== null && !Array.isArray(parcel.events)) throw new SchemaError(PROVIDER, 'Logistics Solution returned an invalid event list');
  const rows = Array.isArray(parcel.events) ? parcel.events : [];
  if (rows.length > 500) throw new SchemaError(PROVIDER, 'Logistics Solution returned too many events');
  // The page reads a parcel without events as one it has no information on yet.
  if (!rows.length) throw new NoHistoryError(PROVIDER);
  const events: CarrierEvent[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (!isRow(row)) throw new SchemaError(PROVIDER, 'Logistics Solution returned an invalid event');
    const at = explicitOffsetTime(row.eventTime);
    const code = text(row.eventCode, 80);
    const message = text(row.eventMessage, 320);
    if (!at || !(message || code)) throw new SchemaError(PROVIDER, 'Logistics Solution returned an invalid event');
    const location = placeOf(row.eventLocation);
    const staged = logisticsSolutionStage(code, message);
    const event: CarrierEvent = {
      time: at.iso, description: message || code, ...(code && message ? { provider_code: code } : {}),
      ...(location ? { location } : {}), ...(staged ? { stage: staged.stage, stage_source: staged.source } : {}),
    };
    const key = JSON.stringify(event);
    if (!seen.has(key)) { seen.add(key); events.push(event); }
  }
  const at = (event: CarrierEvent) => explicitOffsetTime(event.time)!.timestamp;
  events.sort((a, b) => at(b) - at(a));
  const newest = events[0]!;
  // Each event's stage came from the status map or the shared rules.
  const stage = newest.stage as Stage | undefined;
  return {
    status: stage ? languageStageStatus(stage) : 'unknown',
    ...(stage ? { current_stage: stage, current_stage_source: newest.stage_source! } : {}),
    last_status_text: newest.description!, last_update: newest.time!, expected_delivery: null, events: events.slice(0, 100),
    ...(events.length > 100 ? { history_truncated: true } : {}),
  };
}
