import { describe, expect, it } from 'vitest';
import type { TrawlCapturedResponse, TrawlScrapeResponse } from '../../core/transport/index.js';
import { CHINA_POST_WEB_FLAG, CHINA_POST_WEB_TRACE, parseChinaPostWebPreview } from './web.js';

const number = 'ZS00000000001';
const scan = { number, time: '2030-01-02 12:30', code: 'O_051', state: '到达境外目的地' };
const entry = (payload: unknown = { success: true, match: true, scans: [scan] }, overrides = {}): TrawlCapturedResponse => ({
  url: CHINA_POST_WEB_TRACE, status: 200, body: JSON.stringify(payload), trackingNumberSubmitted: number,
  headers: {}, error: null, truncated: false, base64Encoded: false, ...overrides,
});
const page = (...capturedResponses: TrawlCapturedResponse[]): TrawlScrapeResponse => ({
  url: '', html: '', cookies: [], userAgent: null, tier: 3, statusCode: 200, raw: {}, capturedResponses,
});

describe('China Post public web preview', () => {
  it('keeps the carrier order, limited history and local clocks', () => {
    const result = parseChinaPostWebPreview(page(entry({ success: true, match: true,
      scans: [{ ...scan, time: '2030-01-01 23:00:00' }, scan] })), number);
    expect(result).toMatchObject({ current_stage: 'in_transit', history_truncated: true, last_update: null,
      last_update_local: '2030-01-02T12:30:00', events: [{ local_time: '2030-01-02T12:30:00' }, { local_time: '2030-01-01T23:00:00' }] });
    expect(result.events!.every(row => !row.time)).toBe(true);
  });

  it('binds the request, every scan and the final response', () => {
    for (const row of [entry(undefined, { trackingNumberSubmitted: 'ZS00000000002' }), entry({ success: true, match: false }),
      entry({ success: true, match: true, scans: [{ ...scan, number: 'ZS00000000002' }] })]) {
      expect(() => parseChinaPostWebPreview(page(row), number)).toThrow(expect.objectContaining({ kind: 'schema' }));
    }
    expect(() => parseChinaPostWebPreview(page(entry(), entry(undefined, { status: 403 })), number))
      .toThrow(expect.objectContaining({ kind: 'challenge' }));
  });

  it.each([[429, 'rate_limited'], [503, 'maintenance'], [404, 'transport']] as const)('preserves HTTP %i as %s', (status, kind) => {
    expect(() => parseChinaPostWebPreview(page(entry(undefined, { status, headers: { 'retry-after': '30' } })), number))
      .toThrow(expect.objectContaining({ kind, ...(status === 429 ? { retryAfterMs: 30000 } : {}) }));
  });

  it.each([['phone', 'input_required'], ['verification', 'challenge'], ['empty', 'indeterminate'], ['rate_limit', 'rate_limited']] as const)('preserves a %s refusal', (reason, kind) => {
      expect(() => parseChinaPostWebPreview(page(entry({ success: false, reason }, { url: CHINA_POST_WEB_FLAG })), number))
        .toThrow(expect.objectContaining({ kind }));
    });

  it('refuses malformed, empty, private and impossible scans', () => {
    for (const value of [{ invalid: true }, { success: true, match: true, scans: [{ ...scan, time: '2030-02-30 12:00' }] },
      { success: true, match: true, scans: [{ ...scan, state: '联系快递员' }] }]) {
      expect(() => parseChinaPostWebPreview(page(entry(value)), number)).toThrow(expect.objectContaining({ kind: 'schema' }));
    }
    expect(() => parseChinaPostWebPreview(page(entry({ success: true, match: true, scans: [] })), number))
      .toThrow(expect.objectContaining({ name: 'NoHistoryError', kind: 'indeterminate' }));
    expect(() => parseChinaPostWebPreview(page(entry({ success: true, checked: true }, { url: CHINA_POST_WEB_FLAG })), number))
      .toThrow(expect.objectContaining({ kind: 'challenge' }));
  });
});
