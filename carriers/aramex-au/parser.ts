import { isValidSscc, normalizeTrackingNumber } from '../../core/detection/index.js';
import { IndeterminateError, InvalidInputError, NoHistoryError, NotFoundError, SchemaError } from '../../core/errors/index.js';
import type { CarrierEvent, CarrierResult } from '../../core/result/index.js';
import { languageStageStatus, type Stage } from '../../core/status/index.js';
import { calendarDay } from '../../core/time/index.js';
import { cleanScalar } from '../../core/transport/index.js';
import { isRecord } from '../../core/types.js';
import { aramexAuStage } from './status.js';

export const PROVIDER = 'Aramex Australia';
// A parcel's reply is a few kilobytes: a dozen scans with their depots.
export const ARAMEX_AU_MAX_BYTES = 512 * 1024;

// A label: two letters or digits, at least one a letter, then ten digits.
const LABEL = /^(?:[A-Z]{2}|[A-Z]\d|\d[A-Z])\d{10}$/;
// The tracker also finds a parcel by the sender's SSCC printed on it.
const SSCC = /^00\d{18}$/;
const WALL_CLOCK = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/;
const DAY = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const CODE = /^[A-Z0-9]{1,8}$/;
// The page hides these scans: the label's own record and an internal one.
const HIDDEN = new Set(['PP0', 'IOC']);
// Scans before pickup, filed under the depot that will collect: the page shows no place for them.
const BEFORE_PICKUP = new Set(['ARP', 'PP0', 'PP2', 'PP3', 'PP4', 'PP5', 'PP7', 'PP8']);
const MAX_ROWS = 300;
const MAX_EVENTS = 100;

/** A number as the tracker looks it up: upper case, without spaces or dashes. */
export function normalizeAramexAuNumber(raw: string): string {
  const number = raw.length <= 64 ? normalizeTrackingNumber(raw) : '';
  if (LABEL.test(number) || (SSCC.test(number) && isValidSscc(number))) return number;
  throw new InvalidInputError(PROVIDER, 'Aramex Australia tracks a twelve-character label or the SSCC on the parcel');
}

/** An optional text field; an object, array or other value is a changed reply. */
function text(row: Record<string, unknown>, key: string, maxLength = 200): string {
  const value = row[key];
  if (value === null || value === undefined) return '';
  if (typeof value !== 'string' && typeof value !== 'number') throw new SchemaError(PROVIDER, `Aramex Australia returned an invalid ${key}`);
  return cleanScalar(value, maxLength);
}

/** A `YYYY-MM-DD HH:mm:ss` reading as an ISO wall clock, checked field by field. */
function wallOf(value: string): string | null {
  const match = WALL_CLOCK.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match;
  // Luxon accepts hour 24.
  if (!calendarDay(Number(year), Number(month), Number(day)) || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) return null;
  return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
}

/** A `dd/mm/yyyy` day as `YYYY-MM-DD`, or null. */
function dayOf(value: string): string | null {
  const match = DAY.exec(value);
  return match ? calendarDay(Number(match[3]), Number(match[2]), Number(match[1])) : null;
}

/**
 * The scan's place: the depot it was made at. The page renames the regional
 * linehaul partner's depot and shows no place for a scan before pickup.
 */
function placeOf(row: Record<string, unknown>, code: string, heading: string): string {
  if (BEFORE_PICKUP.has(code)) return '';
  const name = text(row, 'Name', 100);
  if (name === 'Linehaul Express Australia') return 'Aramex Regional Network';
  // The page leaves out this depot's name on a delivery.
  if (name === 'Devonport' && heading.includes('Delivered')) return '';
  return /\d/.test(name) ? '' : name;
}

/**
 * One scan: its heading, the depot, the code and the wall clock the depot
 * recorded. The scan's longer explanation, the signatory, the courier's id
 * and the collection point's address are never read.
 */
function eventOf(row: unknown): CarrierEvent | null {
  if (!isRecord(row)) throw new SchemaError(PROVIDER, 'Aramex Australia returned an invalid scan');
  const rawCode = text(row, 'Status', 16).toUpperCase();
  const code = CODE.test(rawCode) ? rawCode : '';
  if (HIDDEN.has(code)) return null;
  const description = text(row, 'Description', 200);
  const local = wallOf(text(row, 'RealDateTime', 40));
  if (!description || !local) throw new SchemaError(PROVIDER, 'Aramex Australia returned a scan without its heading or clock');
  const location = placeOf(row, code, description);
  const staged = aramexAuStage(code, description);
  return { local_time: local, description, ...(location ? { location } : {}), ...(code ? { provider_code: code } : {}),
    ...(staged ? { stage: staged.stage, stage_source: staged.source } : {}) };
}

/**
 * The delivery day the page shows: only while the parcel moves between pickup
 * and the delivering courier, before that day has passed at the pickup depot,
 * and never once a `PP5` label scan is in the history.
 */
function etaOf(result: Record<string, unknown>, newest: CarrierEvent, rows: readonly unknown[]): string | null {
  if (newest.stage !== 'accepted' && newest.stage !== 'in_transit') return null;
  if (!text(result, 'DeliveryFranchiseCode', 16)) return null;
  if (rows.some((row) => isRecord(row) && row.Status === 'PP5')) return null;
  const eta = dayOf(text(result, 'DeliveryETADate', 16));
  const today = dayOf(text(result, 'PickupFranchiseCurrentDate', 16));
  return eta && (!today || today <= eta) ? eta : null;
}

/**
 * The reply of `GET /umbraco/api/TrackingApi/GetTrackingData` for one number:
 * the depots that collect and deliver the parcel with their own date, the
 * label, its scans oldest first and the delivery estimate. A number the
 * tracker has no scans for, unknown or only labelled, gets an error naming it.
 * The signatory, the delivery instructions, the sender's reference and the
 * collection point's details are never read.
 */
export function parseAramexAu(payload: unknown, raw: string): CarrierResult {
  const number = normalizeAramexAuNumber(raw);
  if (!isRecord(payload)) throw new SchemaError(PROVIDER, 'Aramex Australia returned an unexpected reply');
  if (payload.error !== undefined && payload.error !== null) {
    const error = typeof payload.error === 'string' ? payload.error.slice(0, 500) : '';
    if (error === `Label '${number}' does not have any scans.`) throw new NotFoundError(PROVIDER);
    if (/^Label '.*' does not have any scans\.$/s.test(error)) throw new SchemaError(PROVIDER, 'Aramex Australia answered for another number');
    throw new IndeterminateError(PROVIDER, 'Aramex Australia refused the tracking request');
  }
  const result = payload.result;
  if (!isRecord(result)) throw new SchemaError(PROVIDER, 'Aramex Australia returned a reply without its parcel');
  if (normalizeTrackingNumber(text(result, 'LabelNumber', 64)) !== number) {
    throw new SchemaError(PROVIDER, 'Aramex Australia answered for another number');
  }
  const rows = result.Scans ?? [];
  if (!Array.isArray(rows) || rows.length > MAX_ROWS) throw new SchemaError(PROVIDER, 'Aramex Australia returned an invalid parcel history');
  // Oldest first, as the page receives them; it shows them the other way round.
  const events = rows.map(eventOf).filter((event): event is CarrierEvent => event !== null).reverse();
  if (!events.length) throw new NoHistoryError(PROVIDER);

  const newest = events[0]!;
  // A label notice after pickup is no step back.
  const current = events.find((event) => event.stage && event.stage !== 'registered') ?? events.find((event) => event.stage);
  const stage = current?.stage as Stage | undefined;
  const original = normalizeTrackingNumber(text(result, 'OriginalLabelNumber', 64));
  const priority = result.IsPriorityParcel;
  return {
    status: stage ? languageStageStatus(stage) : 'unknown',
    ...(stage ? { current_stage: stage, current_stage_source: current!.stage_source! } : {}),
    last_status_text: newest.description!,
    last_update: null,
    last_update_local: newest.local_time!,
    expected_delivery: etaOf(result, newest, rows),
    ...(typeof priority === 'boolean' ? { service_name: priority ? 'Priority Delivery' : 'Economy Delivery' } : {}),
    // Asked by its SSCC, the parcel keeps Aramex's own label.
    ...(original !== number && LABEL.test(original) ? { canonical_tracking_number: original } : {}),
    events: events.slice(0, MAX_EVENTS),
    ...(events.length > MAX_EVENTS ? { history_truncated: true } : {}),
  };
}
