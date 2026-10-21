import { DateTime } from 'luxon';
import { carrierIdFromPartner } from '../../core/catalog/hints.js';
import { isValidSscc, normalizeTrackingNumber } from '../../core/detection/index.js';
import { IndeterminateError, InvalidInputError, NoHistoryError, SchemaError } from '../../core/errors/index.js';
import type { CarrierEvent, CarrierResult } from '../../core/result/index.js';
import { languageStageStatus, type Stage } from '../../core/status/index.js';
import { explicitOffsetTime } from '../../core/time/index.js';
import { clean } from '../../core/transport/index.js';
import { isRecord } from '../../core/types.js';
import { nzCouriersStage } from './status.js';

export const PROVIDER = 'New Zealand Couriers';
// A consignment of several parcels is a few kilobytes.
export const NZ_COURIERS_MAX_BYTES = 512 * 1024;
// A courier ticket: a product code of two or three letters, or a letter and two
// digits, then the ticket number. The search box takes it with a space or a
// hyphen between them; the number reaches the adapter without one.
const TICKET = /^([A-Z]{2,3}|[A-Z]\d{2})(\d{5,8})$/;
// Charge labels have eight digits, international consignments nine.
const LABEL = /^\d{8,9}$/;
// A customer printed label's consignment number, which the sender's own system
// writes: letters, then digits (four and six on a label seen). One a ticket's
// layout also fits is read as the ticket.
const CONSIGNMENT = /^[A-Z]{2,6}\d{4,12}$/;
// The tracker's lookup refuses a query of fewer than six characters.
const MIN_QUERY = 6;
const MAX_ITEMS = 50;
const MAX_ROWS = 500;
const MAX_EVENTS = 100;
const ZONE = 'Pacific/Auckland';
const ESTIMATE = /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+(\d{1,2})\s+([A-Za-z]+)$/i;

/**
 * The number as the tracker's lookup takes it: a ticket's product code and
 * number, or a label or a customer printed label's consignment number alone.
 */
export type NzCouriersQuery =
  | { kind: 'ticket'; number: string; code: string; query: string }
  | { kind: 'label' | 'consignment'; number: string; query: string };

const withoutZeros = (value: string) => value.replace(/^0+/, '');

/**
 * A ticket, charge label, international consignment or SSCC, as the tracking
 * page sends it: without the number's leading zeros, except in a 20-digit
 * barcode. A customer printed label's consignment number goes whole. Anything
 * else is not a number this tracker reads.
 */
export function nzCouriersQuery(raw: string): NzCouriersQuery {
  const number = raw.length <= 64 ? normalizeTrackingNumber(raw) : '';
  const ticket = TICKET.exec(number);
  if (!ticket && CONSIGNMENT.test(number)) return { kind: 'consignment', number, query: number };
  const query = ticket ? withoutZeros(ticket[2]!) : LABEL.test(number) ? withoutZeros(number) : isValidSscc(number) ? number : '';
  if (query.length < MIN_QUERY) {
    throw new InvalidInputError(PROVIDER, 'New Zealand Couriers numbers are a ticket, an eight- or nine-digit label, an SSCC or a customer printed label');
  }
  return ticket ? { kind: 'ticket', number, code: ticket[1]!, query } : { kind: 'label', number, query };
}

/** An optional text field; anything but a string is a changed reply. */
function text(row: Record<string, unknown>, key: string, maxLength = 300): string {
  const value = row[key];
  if (value === null || value === undefined) return '';
  if (typeof value !== 'string') throw new SchemaError(PROVIDER, `New Zealand Couriers returned an invalid ${key}`);
  return clean(value, maxLength);
}

/**
 * Whether the consignment the reply heads with, `shortConsignmentId`, is the
 * whole number asked: a ticket's product code and number, or the label alone.
 * The ticket number and a short label may come with or without their leading zeros.
 * A customer printed label's consignment number comes after the sender's
 * account number.
 */
function sameConsignment(value: string, asked: NzCouriersQuery): boolean {
  const parts = value.toUpperCase().split(/\s+/).filter(Boolean);
  if (asked.kind === 'ticket') return parts.length === 2 && parts[0] === asked.code && withoutZeros(parts[1]!) === asked.query;
  if (asked.kind === 'consignment') return parts.at(-1) === asked.number && (parts.length === 1 || parts.length === 2 && /^\d+$/.test(parts[0]!));
  return parts.length === 1 && (asked.query.length === 20 ? parts[0] === asked.query : withoutZeros(parts[0]!) === asked.query);
}

/**
 * Where a scan was, as the tracking page shows it: its suburb and region. The
 * postcode and the delivery run are not kept.
 */
function place(row: Record<string, unknown>): string {
  const location = row.location;
  if (location === null || location === undefined) return '';
  if (!isRecord(location)) throw new SchemaError(PROVIDER, 'New Zealand Couriers returned an invalid scan location');
  return [text(location, 'suburb', 80), text(location, 'region', 80)].filter(Boolean).join(', ');
}

interface Scan { event: CarrierEvent; at: number; index: number; network: string }

/**
 * One scan. `createdOn` is an instant in UTC. Its attachments (a signature
 * with the name of whoever signed, a delivery photo), the authority-to-leave
 * tag, the barcode and the driver are not kept.
 */
function projectScan(row: unknown, index: number): Scan {
  if (!isRecord(row)) throw new SchemaError(PROVIDER, 'New Zealand Couriers returned an invalid scan');
  const type = text(row, 'eventType', 16).toUpperCase();
  const subtype = text(row, 'eventSubType', 16).toUpperCase();
  const description = text(row, 'status');
  const at = explicitOffsetTime(row.createdOn);
  if (!type || !description || !at) throw new SchemaError(PROVIDER, 'New Zealand Couriers returned a scan without its type, wording or time');
  const code = subtype ? `${type}/${subtype}` : type;
  const location = place(row);
  const staged = nzCouriersStage(code, description);
  const event: CarrierEvent = {
    time: at.iso,
    ...(location ? { location } : {}),
    description,
    provider_code: code,
    ...(staged ? { stage: staged.stage, stage_source: staged.source } : {}),
  };
  return { event, at: at.timestamp, index, network: text(row, 'carrierName', 40) };
}

/**
 * The delivery estimate, a weekday and a date without a year ("Thursday,
 * 20 February"). It is the next such date from the day before the parcel's
 * first scan in New Zealand, kept only when its weekday agrees.
 */
function estimate(data: Record<string, unknown>, first: number): string | null {
  const parts = ESTIMATE.exec(text(data, 'ETA', 40));
  if (!parts) return null;
  const from = DateTime.fromMillis(first, { zone: ZONE }).minus({ days: 1 });
  // A calendar date: parsing in UTC reads its digits only.
  const date = (year: number) => DateTime.fromFormat(`${parts[2]} ${parts[3]} ${year}`, 'd LLLL yyyy', { zone: 'UTC', locale: 'en-NZ' });
  const day = [date(from.year), date(from.year + 1)].find((candidate) => candidate.isValid && candidate.toISODate() >= from.toISODate()!);
  return day && day.toFormat('cccc', { locale: 'en-NZ' }).toLowerCase() === parts[1]!.toLowerCase() ? day.toISODate() : null;
}

/**
 * The reply of the tracking page's `tracking-events` lookup for one number,
 * which answers HTTP 204 for a number it does not find. A consignment must
 * name the whole number asked. Each of its parcels has its own scans; they
 * are kept together, newest first.
 */
export function parseNzCouriers(payload: unknown, raw: string): CarrierResult {
  const asked = nzCouriersQuery(raw);
  if (!isRecord(payload)) throw new SchemaError(PROVIDER, 'New Zealand Couriers returned an invalid consignment');
  if (typeof payload.shortConsignmentId !== 'string') throw new SchemaError(PROVIDER, 'New Zealand Couriers returned a consignment without its number');
  if (!sameConsignment(clean(payload.shortConsignmentId, 80), asked)) {
    throw new IndeterminateError(PROVIDER, 'New Zealand Couriers answered for another consignment');
  }
  const items = payload.consignmentItems;
  if (!Array.isArray(items) || items.length > MAX_ITEMS) throw new SchemaError(PROVIDER, 'New Zealand Couriers returned a consignment with invalid parcels');

  const seen = new Set<string>();
  const scans: Scan[] = [];
  let index = 0;
  for (const item of items) {
    if (!isRecord(item) || !Array.isArray(item.trackingEvents)) throw new SchemaError(PROVIDER, 'New Zealand Couriers returned a parcel without its scans');
    item.trackingEvents.forEach((row, position) => {
      const scan = projectScan(row, index++);
      // The page shows a parcel's label only when it opens its history.
      if (position > 0 && scan.event.description!.toLowerCase() === 'label created') return;
      const key = JSON.stringify([scan.event.time, scan.event.provider_code, scan.event.description, scan.event.location ?? '']);
      if (seen.has(key)) return;
      seen.add(key);
      scans.push(scan);
    });
    if (index > MAX_ROWS) throw new SchemaError(PROVIDER, 'New Zealand Couriers returned an oversized history');
  }
  if (!scans.length) throw new NoHistoryError(PROVIDER);
  // Newest first; of two scans at one instant, the later in the reply is newer.
  scans.sort((left, right) => right.at - left.at || right.index - left.index);
  const events = scans.map((scan) => scan.event);

  const newest = events[0]!;
  const current = events.find((event) => event.stage);
  const stage = current?.stage as Stage | undefined;
  const delivered = stage === 'delivered' ? current!.time : undefined;
  // Freightways' other networks share the tracker; the network that scanned
  // the parcel last can be another courier's.
  const network = scans.find((scan) => scan.network)?.network;
  const partner = network ? carrierIdFromPartner(network) : undefined;
  return {
    status: stage ? languageStageStatus(stage) : 'unknown',
    ...(current ? { current_stage: current.stage, current_stage_source: current.stage_source } : {}),
    last_status_text: newest.description!,
    last_update: newest.time!,
    expected_delivery: stage === 'delivered' ? null : estimate(payload, scans.at(-1)!.at),
    ...(delivered ? { delivered_at: delivered } : {}),
    ...(partner && partner !== 'nz-couriers' ? { delivery_carrier: partner } : {}),
    events: events.slice(0, MAX_EVENTS),
    ...(events.length > MAX_EVENTS ? { history_truncated: true } : {}),
  };
}
