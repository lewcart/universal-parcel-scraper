import { normalizeTrackingNumber } from '../../core/detection/normalize.js';
import { IndeterminateError, NotFoundError, SchemaError } from '../../core/errors/index.js';
import type { CarrierEvent, CarrierResult } from '../../core/result/index.js';
import { languageStageStatus } from '../../core/status/index.js';
import { epochMillisTime } from '../../core/time/index.js';
import { isRecord } from '../../core/types.js';
import { normalizeDexPkNumber } from './number.js';
import { dexPkStatus } from './status.js';

export { normalizeDexPkNumber } from './number.js';
export const PROVIDER = 'DEX Pakistan';
export const DEX_PK_ORIGIN = 'https://www.dex.com.pk';
export const DEX_PK_SEARCH = `${DEX_PK_ORIGIN}/api/search_packages`;
export const DEX_PK_HISTORY = `${DEX_PK_ORIGIN}/api/get_package_history`;
export const DEX_PK_MAX_BYTES = 256 * 1024;
// These two literal keys in the official map use a slash instead of the usual underscores.
const PICKUP_CODES = new Set(['domestic_pickup/sign_in_failure', 'domestic_pickup/sign_in_success']);

interface DexPackage {
  readonly number: string;
  readonly status: string;
}

function text(value: unknown, field: string, max = 256): string {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string' || value.length > max) throw new SchemaError(PROVIDER, `DEX Pakistan returned an invalid ${field}`);
  return value.replace(/\s+/g, ' ').trim();
}

function status(value: unknown): string {
  const code = text(value, 'status', 64);
  if (!/^[a-z][a-z0-9_]{1,63}$/.test(code) && !PICKUP_CODES.has(code)) throw new SchemaError(PROVIDER, 'DEX Pakistan returned an invalid status');
  return code;
}

function ownNumber(value: unknown, number: string): boolean {
  const returned = text(value, 'tracking number', 64);
  return returned !== '' && normalizeTrackingNumber(returned) === normalizeTrackingNumber(number);
}

function network(item: Record<string, unknown>): void {
  const first = text(item.firstMileShippingProvider, 'first-mile network', 64);
  const last = text(item.lastMileShippingProvider, 'last-mile network', 64);
  if (first !== 'PK-DEX' && last !== 'PK-DEX') {
    throw new IndeterminateError(PROVIDER, 'DEX Pakistan answered for another delivery network');
  }
}

/** The official search binds the whole number and its national network before the history read. */
export function parseDexPkSearch(payload: unknown, raw: string): DexPackage {
  const number = normalizeDexPkNumber(raw);
  if (!isRecord(payload) || payload.success !== true || !Array.isArray(payload.data) || payload.data.length > 20) {
    throw new SchemaError(PROVIDER, 'DEX Pakistan returned an invalid search reply');
  }
  if (!payload.data.length) throw new NotFoundError(PROVIDER);
  if (!payload.data.every(isRecord)) throw new SchemaError(PROVIDER, 'DEX Pakistan returned an invalid package');
  const matches = payload.data.filter((item) => ownNumber(item.trackingNumber, number));
  if (matches.length !== 1) throw new IndeterminateError(PROVIDER, 'DEX Pakistan did not identify the requested package');
  const own = matches[0]!;
  network(own);
  return { number, status: status(own.packageStatus) };
}

/**
 * The guest history needs only the printed number. Its processTime is epoch milliseconds;
 * the official client converts that instant into the viewer's zone. Recipient types,
 * photos and proof-of-delivery objects are deliberately not projected.
 */
export function parseDexPkHistory(payload: unknown, raw: string): CarrierResult {
  const number = normalizeDexPkNumber(raw);
  if (!isRecord(payload) || payload.success !== true) throw new SchemaError(PROVIDER, 'DEX Pakistan returned an invalid history reply');
  if (payload.data === undefined || payload.data === null) {
    throw new IndeterminateError(PROVIDER, 'DEX Pakistan did not provide the package history', { reason: 'history_unavailable' });
  }
  if (!isRecord(payload.data)) throw new SchemaError(PROVIDER, 'DEX Pakistan returned an invalid history');
  const own = payload.data;
  if (!ownNumber(own.trackingNumber, number)) throw new IndeterminateError(PROVIDER, 'DEX Pakistan answered the history for another number');
  network(own);
  if (text(own.destinationCountry, 'destination country', 2) !== 'PK') {
    throw new IndeterminateError(PROVIDER, 'DEX Pakistan answered the history for another country');
  }
  if (!Array.isArray(own.timeline) || own.timeline.length > 1000) throw new SchemaError(PROVIDER, 'DEX Pakistan returned an invalid timeline');
  const current = status(own.status);
  const mapped = dexPkStatus(current);
  const rows = own.timeline.map((row): { event: CarrierEvent; timestamp: number | null } => {
    if (!isRecord(row)) throw new SchemaError(PROVIDER, 'DEX Pakistan returned an invalid scan');
    const code = status(row.status);
    const scan = dexPkStatus(code);
    const place = text(row.location, 'scan location');
    const reason = text(row.reasonCode, 'scan reason');
    const absentTime = row.processTime === null || row.processTime === undefined;
    const time = !absentTime && typeof row.processTime === 'number' && Number.isSafeInteger(row.processTime)
      ? epochMillisTime(row.processTime) : null;
    if (!absentTime && !time) throw new SchemaError(PROVIDER, 'DEX Pakistan returned an invalid scan time');
    return { timestamp: time?.timestamp ?? null, event: {
      ...(time ? { time: new Date(time.timestamp).toISOString() } : {}),
      ...(place ? { location: place } : {}),
      description: `${scan?.title ?? code}${reason ? `: ${reason}` : ''}`,
      provider_code: code,
      ...(scan?.stage ? { stage: scan.stage, stage_source: 'carrier_map' } : {}),
    } };
  });
  rows.sort((a, b) => (b.timestamp ?? -Infinity) - (a.timestamp ?? -Infinity));
  const newest = rows.find((row) => row.timestamp !== null)?.event;
  const delivered = rows.find((row) => row.event.stage === 'delivered' && row.event.time)?.event;
  // Allocation and other bookkeeping notices add no progress; keep the preceding confirmed state.
  const currentStage = mapped?.stage === 'pending'
    ? rows.map(({ event }) => dexPkStatus(event.provider_code ?? '')?.stage).find((stage) => stage && stage !== 'pending') ?? 'pending'
    : mapped?.stage;
  // A current summary ahead of its timeline proves that a nonempty history can still be incomplete.
  const partial = rows.some((row) => row.timestamp === null) || (rows.length > 0 && newest?.provider_code !== current);
  return {
    status: currentStage ? languageStageStatus(currentStage) : 'unknown',
    ...(currentStage ? { current_stage: currentStage, current_stage_source: 'carrier_map' } : {}),
    provider_code: current,
    last_status_text: mapped?.title ?? current,
    last_update: newest?.time ?? null,
    expected_delivery: null,
    ...(delivered?.time ? { delivered_at: delivered.time } : {}),
    destination_country: 'PK',
    timezone: 'Asia/Karachi',
    ...(!rows.length ? { summary_only: true } : {}),
    ...(partial ? { history_truncated: true } : {}),
    events: rows.map(({ event }) => event),
  };
}
