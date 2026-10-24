import { normalizeTrackingNumber } from '../../core/detection/index.js';
import { InvalidInputError, NoHistoryError, NotFoundError, SchemaError } from '../../core/errors/index.js';
import type { CarrierEvent, CarrierResult } from '../../core/result/index.js';
import { classifyWording, languageStageStatus, type Stage } from '../../core/status/index.js';
import { explicitOffsetTime } from '../../core/time/index.js';
import { clean } from '../../core/transport/index.js';
import { isRecord } from '../../core/types.js';
import { allegroOneStage } from './status.js';

export const PROVIDER = 'Allegro One';
// A parcel's reply is a list of short scans; a few kilobytes.
export const ALLEGRO_ONE_MAX_BYTES = 256 * 1024;
// Allegro One's ten-character numbers start A0. Allegro Delivery's start AD and
// have seventeen characters; earlier ones, and some returns, have ten like
// Allegro One's. The older form the tracker still answers is ALE and twelve digits.
const NUMBER = /^(?:A[0D][0-9A-Z]{8}|AD[0-9A-Z]{15}|ALE\d{12})$/;
const MAX_ROWS = 300;
const MAX_EVENTS = 100;

/** An Allegro One number; anything else is a number Allegro One does not issue. */
export function normalizeAllegroOneNumber(raw: string): string {
  const number = raw.length <= 64 ? normalizeTrackingNumber(raw) : '';
  if (!NUMBER.test(number)) {
    throw new InvalidInputError(PROVIDER, 'Allegro One numbers are A0 or AD and eight letters and digits, AD and fifteen, or ALE and twelve digits');
  }
  return number;
}

interface Scan {
  readonly event: CarrierEvent & { time: string; description: string };
  readonly at: number;
  readonly index: number;
}

function projectScan(row: unknown, index: number): Scan {
  if (!isRecord(row) || typeof row.eventTimestamp !== 'string' || typeof row.description !== 'string') {
    throw new SchemaError(PROVIDER, 'Allegro One returned an invalid scan');
  }
  const time = explicitOffsetTime(row.eventTimestamp);
  if (!time) throw new SchemaError(PROVIDER, 'Allegro One returned a scan without an offset time');
  const description = clean(row.description, 300);
  if (!description) throw new SchemaError(PROVIDER, 'Allegro One returned a scan without wording');
  const stage = allegroOneStage(description);
  return {
    event: { time: time.iso, description, ...(stage ? { stage, stage_source: 'carrier_map' } : {}) },
    at: time.timestamp,
    index,
  };
}

/**
 * The reply of `GET /ad/tracking?packageNo={number}` on Allegro's edge
 * gateway: `{ "status": [...] }`, each scan a UTC instant and a wording. It
 * does not echo the number: the scans are those of the number in the request.
 * An empty or null list is what the tracker shows as "not found". A fresh A0 or
 * AD number lists scans from its label on, so an empty list is not found for
 * them; an older Allegro Delivery parcel whose scans the service dropped reads
 * the same. For the older ALE form it stays inconclusive.
 */
export function parseAllegroOne(payload: unknown, raw: string): CarrierResult {
  const number = normalizeAllegroOneNumber(raw);
  if (!isRecord(payload) || !('status' in payload) || (payload.status !== null && !Array.isArray(payload.status))) {
    throw new SchemaError(PROVIDER, 'Allegro One returned an unexpected reply');
  }
  const rows = (payload.status ?? []) as unknown[];
  if (rows.length > MAX_ROWS) throw new SchemaError(PROVIDER, 'Allegro One returned an oversized history');
  if (!rows.length) {
    if (number.startsWith('ALE')) throw new NoHistoryError(PROVIDER, 'Allegro One has no scans for this number');
    throw new NotFoundError(PROVIDER);
  }

  const seen = new Set<string>();
  const scans: Scan[] = [];
  rows.forEach((row, index) => {
    const scan = projectScan(row, index);
    const key = `${scan.event.time}\n${scan.event.description}`;
    if (seen.has(key)) return;
    seen.add(key);
    scans.push(scan);
  });
  // The reply lists an older parcel's scans newest first and a newer one's
  // oldest first; the tracker shows them newest first. Instants order them,
  // and equal ones keep the order in which the reply logged them.
  const oldestFirst = scans.length > 1 && scans[0]!.at < scans.at(-1)!.at;
  scans.sort((left, right) => right.at - left.at || (oldestFirst ? right.index - left.index : left.index - right.index));
  // Once the parcel has waited at a point, a courier collecting it is the
  // uncollected parcel taken back, on its way to another point or to the
  // sender, not the sender's drop-off accepted. Once it is sent back, every
  // later movement is the way back: its delivery reaches the sender, not the
  // recipient.
  let waited = false;
  let returning = false;
  for (const { event } of [...scans].reverse()) {
    if (waited && event.stage === 'accepted') event.stage = 'in_transit';
    if (returning && event.stage && event.stage !== 'exception') event.stage = 'returned';
    if (event.stage === 'ready_for_pickup') waited = true;
    if (event.stage === 'returned') returning = true;
  }
  const newest = scans[0]!.event;
  const current = newest.stage
    ? { stage: newest.stage as Stage, source: 'carrier_map' }
    : classifyWording(newest.description, 'in_transit');
  const stage = current.source !== 'none' ? current.stage : undefined;
  return {
    status: stage ? languageStageStatus(stage) : 'unknown',
    ...(stage ? { current_stage: stage, current_stage_source: current.source } : {}),
    last_status_text: newest.description,
    last_update: newest.time,
    expected_delivery: null,
    ...(stage === 'delivered' ? { delivered_at: newest.time } : {}),
    events: scans.slice(0, MAX_EVENTS).map((scan) => scan.event),
    ...(scans.length > MAX_EVENTS ? { history_truncated: true } : {}),
  };
}
