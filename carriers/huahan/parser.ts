import { DateTime } from 'luxon';
import { normalizeTrackingNumber } from '../../core/detection/index.js';
import { ChallengeError, IndeterminateError, InvalidInputError, NoHistoryError, NotFoundError, RateLimitedError, SchemaError } from '../../core/errors/index.js';
import type { CarrierEvent, CarrierResult } from '../../core/result/index.js';
import { languageStageStatus } from '../../core/status/index.js';
import { clean } from '../../core/transport/text.js';
import { isRecord } from '../../core/types.js';
import { huahanStage } from './status.js';

export const PROVIDER = 'HuaHan Logistics';

export function normalizeHuahanNumber(raw: string): string {
  const number = raw.length <= 64 ? normalizeTrackingNumber(raw) : '';
  if (!/^HHW[A-Z]{2}\d{10}YQ$/.test(number)) throw new InvalidInputError(PROVIDER, 'HuaHan requires its complete waybill number');
  return number;
}

function text(row: Record<string, unknown>, key: string, max = 500): string {
  const value = row[key];
  if (value == null) return '';
  if (typeof value !== 'string' || value.length > max) throw new SchemaError(PROVIDER, 'HuaHan returned an invalid tracking field');
  return clean(value, max);
}

function clock(value: string): string {
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
    const parsed = DateTime.fromFormat(value, 'yyyy-MM-dd HH:mm:ss', { zone: 'UTC' });
    if (parsed.isValid && parsed.toFormat('yyyy-MM-dd HH:mm:ss') === value) return value.replace(' ', 'T');
  }
  throw new SchemaError(PROVIDER, 'HuaHan returned an invalid scan clock');
}

/** The public form submits one whole waybill; aliases and partner numbers do not bind its reply. */
export function parseHuahan(payload: unknown, raw: string): CarrierResult {
  const number = normalizeHuahanNumber(raw);
  if (!isRecord(payload)) throw new SchemaError(PROVIDER, 'HuaHan returned an invalid envelope');
  if (payload.ask === 0) {
    const message = text(payload, 'msg');
    if (/验证|驗證|captcha|verification/i.test(message)) throw new ChallengeError(PROVIDER, 'HuaHan refused verification');
    if (/频繁|頻繁|too many|rate limit/i.test(message)) throw new RateLimitedError(PROVIDER);
    if (message === '没有找到记录' && Array.isArray(payload.data) && payload.data.length === 0) throw new NotFoundError(PROVIDER);
    throw new IndeterminateError(PROVIDER, 'HuaHan could not answer this lookup');
  }
  if (payload.ask !== 1 || !Array.isArray(payload.data) || payload.data.length !== 1 || !isRecord(payload.data[0])) {
    throw new SchemaError(PROVIDER, 'HuaHan returned no unique tracking result');
  }
  const row = payload.data[0];
  if (text(row, 'Code', 64).toUpperCase() !== number) throw new SchemaError(PROVIDER, 'HuaHan returned another waybill');
  if (text(row, 'Error_code', 32) !== '0000') throw new IndeterminateError(PROVIDER, 'HuaHan did not confirm its tracking result');
  if (!Array.isArray(row.Detail) || row.Detail.length > 500) throw new SchemaError(PROVIDER, 'HuaHan returned an invalid history');
  if (!row.Detail.length) throw new NoHistoryError(PROVIDER);
  const events: CarrierEvent[] = row.Detail.map((scan: unknown) => {
    if (!isRecord(scan)) throw new SchemaError(PROVIDER, 'HuaHan returned an invalid scan');
    const description = text(scan, 'Comment');
    if (!description) throw new SchemaError(PROVIDER, 'HuaHan returned an empty scan');
    const code = text(scan, 'Status', 32);
    const location = text(scan, 'track_area', 200);
    const staged = huahanStage(code, description);
    return { local_time: clock(text(scan, 'Occur_date', 32)), description,
      ...(code ? { provider_code: code } : {}), ...(location ? { location } : {}),
      ...(staged ? { stage: staged.stage, stage_source: staged.source } : {}) };
  });
  // The page renders Detail in server order, newest first. Clocks from different facilities cannot be sorted as instants.
  const newest = events[0]!;
  const current = huahanStage(newest.provider_code ?? '', newest.description!) ?? huahanStage('', text(row, 'Status'));
  return { status: current ? languageStageStatus(current.stage) : 'unknown',
    ...(current ? { current_stage: current.stage, current_stage_source: current.source } : {}),
    ...(newest.provider_code ? { provider_code: newest.provider_code } : {}),
    last_status_text: newest.description!, last_update: null, last_update_local: newest.local_time!, expected_delivery: null,
    events: events.slice(0, 100), ...(events.length > 100 ? { history_truncated: true } : {}) };
}
