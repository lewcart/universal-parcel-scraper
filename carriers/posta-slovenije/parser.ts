import { isValidS10TrackingNumber, normalizeTrackingNumber } from '../../core/detection/index.js';
import { IndeterminateError, InvalidInputError, SchemaError } from '../../core/errors/index.js';
import type { CarrierEvent, CarrierResult } from '../../core/result/index.js';
import { lastMovement } from '../../core/result/pickup.js';
import { classifyWording, languageStageStatus, type Stage } from '../../core/status/index.js';
import { explicitOffsetTime } from '../../core/time/index.js';
import { clean } from '../../core/transport/index.js';
import { isRecord } from '../../core/types.js';
import { postaSlovenijeStage, startsReturn } from './status.js';

export const PROVIDER = 'Pošta Slovenije';
// A long history is a few kilobytes.
export const POSTA_SLOVENIJE_MAX_BYTES = 512_000;

const MAX_ROWS = 500;
const MAX_EVENTS = 100;
const CODE = /^[A-Z0-9]{1,20}$/;
// The unit type of a post office; a parcel locker is 8.
const POST_OFFICE = 99;

/**
 * Pošta Slovenije tracks UPU S10 items: the ones it issues, which end in SI,
 * and the ones other posts hand it to deliver.
 */
export function normalizePostaSlovenijeNumber(raw: string): string {
  const number = normalizeTrackingNumber(raw);
  if (isValidS10TrackingNumber(number)) return number;
  throw new InvalidInputError(PROVIDER, 'Pošta Slovenije tracks S10 item codes');
}

/** The service's not-found reply names the number it looked for: "Record not found for Id '…'". */
export function isNotFoundReply(payload: unknown, number: string): boolean {
  if (!isRecord(payload) || payload.errorCode !== 'error.not.found') return false;
  const named = /\bId '([^']*)'/.exec(clean(payload.errorMessage, 200))?.[1];
  return named === undefined || named.trim().toUpperCase() === number;
}

interface Scan {
  readonly event: CarrierEvent;
  readonly at: number;
  readonly code: string;
  readonly postOffice: boolean;
  readonly index: number;
}

/** The scan's English heading, its detail line and the next step after a failed delivery, as the tracker lists them. */
function wordingOf(row: Record<string, unknown>): string {
  const parts = [clean(row.codeDescriptionEN, 300) || clean(row.codeDescriptionSI, 300),
    clean(row.codeDetailedDescriptionEN, 300), clean(row.nondeliveryActionEN, 300)]
    .map(part => part.replace(/[.\s]+$/, '')).filter(Boolean);
  return [...new Set(parts)].join('. ');
}

/**
 * The guest lookup's reply for one number: the parcel and its scans, oldest
 * first, each with a code, wording in Slovenian and English, a UTC clock and
 * the post office it happened at. Sender, recipient, signatory, pickup codes
 * and addresses are left out.
 */
export function parsePostaSlovenije(payload: unknown, rawNumber: string): CarrierResult {
  const number = normalizePostaSlovenijeNumber(rawNumber);
  const result = isRecord(payload) ? payload.result : undefined;
  if (!isRecord(result) || !isRecord(result.parcel)) throw new SchemaError(PROVIDER, 'Pošta Slovenije did not return a parcel');
  const parcel = result.parcel;
  if (typeof parcel.trackingNumber !== 'string' || parcel.trackingNumber.trim().toUpperCase() !== number) {
    throw new SchemaError(PROVIDER, 'Pošta Slovenije answered for a different parcel');
  }
  const rows = result.statuses ?? [];
  if (!Array.isArray(rows) || rows.length > MAX_ROWS) throw new SchemaError(PROVIDER, 'Pošta Slovenije returned an invalid parcel history');

  const scans: Scan[] = [];
  const seen = new Set<string>();
  rows.forEach((row, index) => {
    if (!isRecord(row)) throw new SchemaError(PROVIDER, 'Pošta Slovenije returned an invalid scan');
    const code = clean(row.code, 40);
    const at = explicitOffsetTime(row.statusDateTime);
    if (!CODE.test(code) || !at) throw new SchemaError(PROVIDER, 'Pošta Slovenije returned a scan without a code or clock');
    // The post office's name; its number, a postcode, is left out.
    const place = clean(row.postalName, 120);
    const event: CarrierEvent = { time: at.iso, description: wordingOf(row) || code, provider_code: code, ...(place ? { location: place } : {}) };
    const identity = JSON.stringify(event);
    if (seen.has(identity)) return;
    seen.add(identity);
    scans.push({ event, at: at.timestamp, code, postOffice: row.unitType === POST_OFFICE, index });
  });
  // Newest first; scans at the same instant follow the reply's order, reversed.
  scans.sort((left, right) => right.at - left.at || right.index - left.index);

  // Oldest first: a delivery after the item was sent back reaches its sender.
  let returning = false;
  for (const scan of [...scans].reverse()) {
    const description = scan.event.description!;
    const classified = postaSlovenijeStage(scan.code, description);
    if (startsReturn(scan.code, description)) returning = true;
    if (!classified) continue;
    const stage: Stage = classified.stage === 'delivered' && returning ? 'returned' : classified.stage;
    Object.assign(scan.event, { stage, stage_source: classified.source });
  }
  const events = scans.map(scan => scan.event);

  if (!scans.length) return summaryOf(parcel);
  const decider = scans[0]!;
  const stage = decider.event.stage as Stage | undefined;

  // The post office an item waits at is its pickup point. A delivered item
  // was collected there when it waited there last before the delivery.
  const earlier = scans.slice(1);
  const waiting = stage === 'ready_for_pickup' ? decider
    : stage === 'delivered' && lastMovement(earlier.map(scan => scan.event)) === 'ready_for_pickup'
      ? earlier.find(scan => scan.event.stage === 'ready_for_pickup') : undefined;
  const point = waiting?.postOffice ? waiting.event.location ?? '' : '';

  return {
    status: stage ? languageStageStatus(stage) : 'unknown',
    ...(stage ? { current_stage: stage, current_stage_source: decider.event.stage_source } : {}),
    last_status_text: decider.event.description!,
    last_update: decider.event.time!,
    expected_delivery: null,
    ...(stage === 'delivered' ? { delivered_at: decider.event.time! } : {}),
    ...(point ? { pickup_point: point } : {}),
    events: events.slice(0, MAX_EVENTS),
    ...(events.length > MAX_EVENTS ? { history_truncated: true } : {}),
  };
}

/** A parcel without scans: its own heading and the clock of its state. */
function summaryOf(parcel: Record<string, unknown>): CarrierResult {
  const wording = clean(parcel.codeDescriptionEN, 300) || clean(parcel.codeDescriptionSI, 300);
  if (!wording) throw new IndeterminateError(PROVIDER, 'Pošta Slovenije returned a parcel without a state or scans');
  const classified = classifyWording(wording, 'in_transit');
  const stage = classified.source === 'none' ? undefined : classified.stage;
  return {
    status: stage ? languageStageStatus(stage) : 'unknown',
    ...(stage ? { current_stage: stage, current_stage_source: classified.source } : {}),
    last_status_text: wording,
    summary_only: true,
    last_update: explicitOffsetTime(parcel.currentStatusDateTime)?.iso ?? null,
    expected_delivery: null,
    events: [],
  };
}
