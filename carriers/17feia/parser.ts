import { DateTime } from 'luxon';
import { detectCarrierMatch, normalizeTrackingNumber } from '../../core/detection/index.js';
import { dpdParcelNumber } from '../../core/detection/dpd.js';
import { IndeterminateError, InvalidInputError, NotFoundError, SchemaError } from '../../core/errors/index.js';
import type { CarrierEvent, CarrierResult } from '../../core/result/index.js';
import { languageStageStatus, type Stage } from '../../core/status/index.js';
import { countryTimeZone, firstOccurrence } from '../../core/time/index.js';
import { cleanScalar } from '../../core/transport/index.js';
import { isRecord } from '../../core/types.js';
import { ESTIMATE_LABEL, seventeenFeiaStage } from './status.js';

export const PROVIDER = '17FEIA';
// A long history is a few dozen kilobytes.
export const SEVENTEENFEIA_MAX_BYTES = 512 * 1024;
// FEI, the branch (SH Shanghai, SZ Shenzhen), ten digits and two letters.
const NUMBER = /^FEI[A-Z]{2}\d{10}[A-Z]{2}$/;
const WALL_CLOCK = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/;
const OFFSET = /^([+-])(\d{2}):(\d{2})$/;
// 17FEIA's backend keeps the order data on Beijing time; offset-less rows are read in it only to hold back future ones.
const HOME_ZONE = 'Asia/Shanghai';
const MAX_ROWS = 500;
const MAX_EVENTS = 100;

/** 17FEIA's names for the carriers it hands parcels to, by the catalog id that tracks them. */
export const SEVENTEENFEIA_PARTNERS: Readonly<Record<string, string>> = {
  'DPD-DE': 'dpd-de',
  'DE-DHL': 'dhl',
  'FEDEX-GROUND': 'fedex',
};

// The destination as the reply names it, in Chinese.
const DESTINATIONS: Readonly<Record<string, string>> = {
  德国: 'DE', 法国: 'FR', 荷兰: 'NL', 波兰: 'PL', 美国: 'US',
};

/** A 17FEIA order number; anything else is a number its tracker is not asked for. */
export function normalizeSeventeenFeiaNumber(raw: string): string {
  const number = raw.length <= 64 ? normalizeTrackingNumber(raw) : '';
  if (!NUMBER.test(number)) throw new InvalidInputError(PROVIDER, '17FEIA order numbers are FEI, two letters, ten digits and two letters');
  return number;
}

/** An optional text field; an object or array is a changed reply. */
function text(row: Record<string, unknown>, key: string, maxLength = 500): string {
  const value = row[key];
  if (value === null || value === undefined) return '';
  if (typeof value !== 'string' && typeof value !== 'number') throw new SchemaError(PROVIDER, `17FEIA returned an invalid ${key}`);
  return cleanScalar(value, maxLength);
}

/**
 * A row's clock. Its `timeZone` counts only beside a country whose clock has
 * that offset at that time: 17FEIA's own milestones carry the destination's
 * standard offset over a wall clock several destinations share, and name no
 * country. Every other row keeps its wall clock.
 */
function clockOf(stamp: string, label: string, country: string): { time: string; at: number } | { local_time: string; at: number } {
  const wall = WALL_CLOCK.exec(stamp);
  const local = wall ? `${wall[1]}T${wall[2]}` : '';
  const home = local ? firstOccurrence(DateTime.fromISO(local, { zone: HOME_ZONE })) : null;
  // Luxon rolls 24:00:00 over to the next day; only a clock that reads back unchanged is kept.
  if (!home?.isValid || home.toFormat("yyyy-MM-dd'T'HH:mm:ss") !== local) throw new SchemaError(PROVIDER, '17FEIA returned an invalid scan time');
  const offset = OFFSET.exec(label);
  const zone = offset ? countryTimeZone(country) : null;
  if (offset && zone) {
    const minutes = (offset[1] === '-' ? -1 : 1) * (Number(offset[2]) * 60 + Number(offset[3]));
    const placed = firstOccurrence(DateTime.fromISO(local, { zone }));
    const time = placed.isValid && placed.offset === minutes ? placed.toISO({ suppressMilliseconds: true }) : null;
    if (time) return { time, at: placed.toMillis() };
  }
  return { local_time: local, at: home.toMillis() };
}

function projectRow(row: unknown, readAt: number): { key: string; event: CarrierEvent } | null {
  if (!isRecord(row)) throw new SchemaError(PROVIDER, '17FEIA returned an invalid scan');
  const label = text(row, 'status', 64);
  const description = text(row, 'description');
  if (!description || label === ESTIMATE_LABEL) return null;
  const stamp = text(row, 'createTime', 64);
  const country = text(row, 'country', 8).toUpperCase();
  const { at, ...clock } = clockOf(stamp, text(row, 'timeZone', 16), country);
  // A row dated after the read is not a scan yet.
  if (at > readAt) return null;
  const place = text(row, 'location', 200) || text(row, 'city', 200);
  const location = [place, /^[A-Z]{2}$/.test(country) ? country : ''].filter(Boolean).join(', ');
  const staged = seventeenFeiaStage(label, description);
  const event: CarrierEvent = {
    ...clock,
    description,
    ...(location ? { location } : {}),
    ...(label ? { provider_code: label } : {}),
    ...(staged ? { stage: staged.stage, stage_source: staged.source } : {}),
  };
  return { key: JSON.stringify([stamp, label, description, location]), event };
}

/** The partner's number, when 17FEIA names a partner the catalog tracks and the number is one of its own. */
function handoff(order: Record<string, unknown>): { delivery_carrier: string; delivery_tracking_number: string } | null {
  const label = text(order, 'deliveryCompany', 64).toUpperCase();
  const partner = Object.hasOwn(SEVENTEENFEIA_PARTNERS, label) ? SEVENTEENFEIA_PARTNERS[label]! : undefined;
  const raw = normalizeTrackingNumber(text(order, 'deliveryNumber', 64));
  // DPD's tracking takes the fourteen digits, without the check character a label adds.
  const number = partner === 'dpd-de' ? dpdParcelNumber(raw) : raw;
  if (!partner || !number || !/^[A-Z0-9]{4,40}$/.test(number)) return null;
  return (detectCarrierMatch(number).candidates as string[]).includes(partner)
    ? { delivery_carrier: partner, delivery_tracking_number: number } : null;
}

/**
 * The reply of `GET /public/v1/ordeSearch/listTrackInfos/{number}`. The
 * search also finds an order by its partner's or another forwarder's number,
 * so the order counts only when its own number is the one asked. Rows come
 * newest first and keep that order: their clocks are not all instants. The
 * rows' postcodes, states and ids, the order id and its weight are not read.
 */
export function parseSeventeenFeia(payload: unknown, raw: string, readAt = Date.now()): CarrierResult {
  const number = normalizeSeventeenFeiaNumber(raw);
  if (!isRecord(payload) || typeof payload.flag !== 'boolean') throw new SchemaError(PROVIDER, '17FEIA returned an invalid envelope');
  if (!payload.flag) {
    // The tracker answers an order it does not know with a bare refusal and shows "no progress yet".
    if (payload.obj === null && [null, undefined, ''].includes(payload.msg as string) && [null, undefined].includes(payload.code as null)) {
      throw new NotFoundError(PROVIDER);
    }
    throw new IndeterminateError(PROVIDER, '17FEIA did not complete the lookup');
  }
  const order = payload.obj;
  if (!isRecord(order)) throw new SchemaError(PROVIDER, '17FEIA returned an invalid order');
  if (normalizeTrackingNumber(text(order, 'insideNumber', 64)) !== number) {
    throw new IndeterminateError(PROVIDER, '17FEIA answered with another order');
  }
  const rows = order.currentOrderTrackInfos;
  if (!Array.isArray(rows)) throw new SchemaError(PROVIDER, '17FEIA returned an order without scans');
  if (rows.length > MAX_ROWS) throw new SchemaError(PROVIDER, '17FEIA returned an oversized history');

  const seen = new Set<string>();
  const events: CarrierEvent[] = [];
  for (const row of rows) {
    const scan = projectRow(row, readAt);
    if (!scan || seen.has(scan.key)) continue;
    seen.add(scan.key);
    events.push(scan.event);
  }
  if (!events.length) throw new IndeterminateError(PROVIDER, '17FEIA has no scans for the order yet');

  const newest = events[0]!;
  const current = events.find((event) => event.stage);
  const stage = current?.stage as Stage | undefined;
  const destination = text(order, 'destination', 64);
  const country = Object.hasOwn(DESTINATIONS, destination) ? DESTINATIONS[destination] : undefined;
  return {
    status: stage ? languageStageStatus(stage) : 'unknown',
    ...(stage ? { current_stage: stage, current_stage_source: current!.stage_source! } : {}),
    last_status_text: newest.description!,
    last_update: newest.time ?? null,
    ...(newest.local_time ? { last_update_local: newest.local_time } : {}),
    expected_delivery: null,
    ...(stage === 'delivered' && current!.time ? { delivered_at: current!.time } : {}),
    ...handoff(order),
    ...(country ? { destination_country: country } : destination ? { destination_country_name: destination } : {}),
    events: events.slice(0, MAX_EVENTS),
    ...(events.length > MAX_EVENTS ? { history_truncated: true } : {}),
  };
}
