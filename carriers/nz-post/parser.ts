import { DateTime } from 'luxon';
import { isValidS10TrackingNumber } from '../../core/detection/s10.js';
import { IndeterminateError, InvalidInputError, NotFoundError, SchemaError } from '../../core/errors/index.js';
import type { CarrierEvent, CarrierResult } from '../../core/result/index.js';
import { countryTimeZone, explicitOffsetTime, isoTime } from '../../core/time/index.js';
import { clean } from '../../core/transport/index.js';
import { isRecord } from '../../core/types.js';
import { trackingPlace } from '../../places/trackingLocation.js';
import { isNzPostPlaceholderLocation } from './identity.js';
import { classifyNzPostStatus } from './status.js';

// Courier labels add a three-letter depot, three digits and a two-letter suffix
// to sixteen digits. The tracker answers the whole label, not the digits alone.
const LABEL = /^\d{16}[A-Z]{3}\d{3}[A-Z]{2}$/;

export function normalizeNzPostNumber(raw: string): string {
  const number = raw.toUpperCase().replace(/\s/g, '');
  if (!/^\d{20}$/.test(number) && !LABEL.test(number) && !isValidS10TrackingNumber(number)) {
    throw new InvalidInputError('nz-post', 'NZ Post requires a domestic parcel barcode, courier label or valid postal tracking number');
  }
  return number;
}

function clock(value: unknown): Pick<CarrierEvent, 'time'> & Record<string, string> {
  if (value != null && typeof value !== 'string') throw new SchemaError('nz-post', 'NZ Post returned an invalid clock field');
  const raw = clean(value, 64);
  const iso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):?[0-5]\d)$/i.test(raw)
    ? explicitOffsetTime(raw) : null;
  if (iso) return { time: iso.iso };
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?$/.test(raw)) {
    const parsed = DateTime.fromISO(raw, { zone: 'UTC' });
    const local = parsed.isValid ? parsed.toISO({ includeOffset: false, suppressMilliseconds: true }) : null;
    if (local) return { local_time: local };
  }
  return raw ? { provider_time_text: raw } : {};
}

const INTERNATIONAL_DEPARTURE = '5007';
/** An airline's scan, "In transit with airline": 5064, or a 528x code (5280 to 5285 seen on an EMS item). */
const AIRLINE = /^(?:5064|528\d)$/;

/** A scan abroad: its wall clock and the zone its depot names, by its index in the source. */
interface AbroadScan { index: number; wall: string; zone: string | null }

/**
 * NZ Post reads the wall clock of a scan abroad as New Zealand's: a Guangzhou
 * customs scan at 12:47 local came as 00:47Z, 12:47 in Auckland, and UPU
 * dates it 12:47 at the Guangzhou office of exchange (checked 2026-10-10). Its
 * own scans are right: an Auckland departure at 13:55 local came as 01:55Z.
 * So a scan abroad gets its wall clock back on Auckland's, to be read on the
 * clock of the country its depot names.
 */
function abroadScan(index: number, clocked: ReturnType<typeof clock>, depot: string): AbroadScan | null {
  const wall = clocked.time ? DateTime.fromISO(clocked.time, { setZone: true }).setZone('Pacific/Auckland')
    .toISO({ includeOffset: false, suppressMilliseconds: true }) : null;
  return wall ? { index, wall, zone: depot ? countryTimeZone(trackingPlace(depot).country) : null } : null;
}

/**
 * The clock of a scan abroad whose depot names a town ("GUANGZHOU") or a
 * country with several clocks, a guess: the zone of the nearest earlier scan
 * abroad whose depot places it, else of the nearest later one. All of them are
 * the destination post's. Null when none does, and the scan stays a wall time.
 */
function abroadZone(scans: readonly AbroadScan[], position: number): string | null {
  const scan = scans[position]!;
  if (scan.zone) return scan.zone;
  return scans.slice(0, position).reverse().find(other => other.zone)?.zone
    ?? scans.slice(position + 1).find(other => other.zone)?.zone ?? null;
}

export function parseNzPost(payload: unknown, number: string): CarrierResult {
  const requested = normalizeNzPostNumber(number);
  if (!isRecord(payload) || typeof payload.success !== 'boolean' || !Number.isInteger(payload.status_code)) throw new SchemaError('nz-post');
  if (payload.success !== true) throw new IndeterminateError('nz-post', 'NZ Post did not complete the lookup');
  if (!Array.isArray(payload.results) || payload.results.length > 100 || !payload.results.every(isRecord)) throw new SchemaError('nz-post');
  if (!payload.results.length) throw new IndeterminateError('nz-post', 'NZ Post returned no parcel result');
  if (payload.results.length !== 1 || typeof payload.results[0]!.tracking_reference !== 'string'
    || payload.results[0]!.tracking_reference.trim().toUpperCase() !== requested) {
    throw new SchemaError('nz-post', 'NZ Post did not return one exact parcel reference');
  }
  const item = payload.results[0]!;
  if (item.errors !== undefined) {
    if (!Array.isArray(item.errors) || !item.errors.every(isRecord)) throw new SchemaError('nz-post');
    if (item.errors.length) {
      const error = item.errors[0]!;
      if (payload.status_code === 2 && item.errors.length === 1 && !Object.hasOwn(item, 'tracking_events')
        && error.code === 400002 && error.message === 'Invalid parameter(s)'
        && error.details === 'No data found for this Tracking Reference') throw new NotFoundError('nz-post');
      throw new IndeterminateError('nz-post', 'NZ Post returned an unrecognized tracking error');
    }
  }
  if (payload.status_code !== 1) throw new IndeterminateError('nz-post', 'NZ Post returned an incomplete lookup');
  if (!Array.isArray(item.tracking_events) || item.tracking_events.length > 500) throw new SchemaError('nz-post');
  // On an item NZ Post sends abroad, the scans after its international
  // departure happen abroad, but for an airline's, whose clock was not checked,
  // and one whose depot names New Zealand. The source lists the oldest first.
  const outbound = /^[A-Z]{2}\d{9}NZ$/.test(requested);
  let departed = false;
  const abroadScans: AbroadScan[] = [];
  const projected = item.tracking_events.map((raw, index): CarrierEvent => {
    if (!isRecord(raw)) throw new SchemaError('nz-post');
    const description = clean(raw.status, 300);
    const code = clean(raw.edifact_code, 40);
    if (!description || !code) throw new SchemaError('nz-post', 'NZ Post returned an incomplete scan');
    const depot = clean(raw.depot_name, 160);
    const location = isNzPostPlaceholderLocation(depot) ? '' : depot;
    const mapped = classifyNzPostStatus(code);
    const abroad = departed && !AIRLINE.test(code) && !(location && trackingPlace(location).country === 'NZ');
    if (outbound && code === INTERNATIONAL_DEPARTURE) departed = true;
    // Long descriptions embed signatures and other recipient details. The
    // short status and depot name carry the tracking evidence independently.
    const clocked = clock(raw.date_time);
    const scan = abroad ? abroadScan(index, clocked, location) : null;
    if (scan) abroadScans.push(scan);
    return { ...clocked, description, provider_code: code,
      ...(location ? { location } : {}), ...(mapped ? { stage: mapped.stage } : {}) };
  });
  abroadScans.forEach((scan, position) => {
    const zone = abroadZone(abroadScans, position);
    const placed = zone ? isoTime(scan.wall, zone) : null;
    const event: CarrierEvent = { ...projected[scan.index]!, ...placed ? { time: placed.iso } : { local_time: scan.wall } };
    if (!placed) delete event.time;
    projected[scan.index] = event;
  });
  if (!projected.length) throw new IndeterminateError('nz-post', 'NZ Post returned no parcel history');
  // The consumer client treats the last source row as current. Preserve that
  // order if any clock is unresolved instead of promoting an older dated row.
  projected.reverse();
  if (projected.every(event => event.time)) projected.sort((a, b) => Date.parse(b.time!) - Date.parse(a.time!));
  const seen = new Set<string>();
  const events = projected.filter(event => {
    const key = JSON.stringify(event);
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
  const latest = events[0]!;
  const current = classifyNzPostStatus(latest.provider_code!);
  return { status: current?.status ?? 'unknown', ...(current ? { current_stage: current.stage } : {}),
    last_status_text: latest.description, last_update: latest.time ?? null,
    ...(latest.local_time ? { last_update_local: latest.local_time } : {}), expected_delivery: null,
    ...(current?.stage === 'delivered' && latest.time ? { delivered_at: latest.time } : {}), events: events.slice(0, 100) };
}
