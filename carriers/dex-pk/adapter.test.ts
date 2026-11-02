import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { AdapterRegistry, type AdapterEnvironment } from '../../core/adapter/index.js';
import { detectCarrierMatch } from '../../core/detection/index.js';
import { InvalidInputError, UpstreamNetworkError } from '../../core/errors/index.js';
import { recognitionCandidates } from '../../core/recognition/index.js';
import { fillPartialAnswer, isPartialAnswer } from '../../core/result/partial.js';
import { resolveResult } from '../../core/result/resolve.js';
import { NOOP_RECORDER, type StepRecord, type StepRecorder } from '../../core/telemetry/index.js';
import { createTracker } from '../../facade/index.js';
import { adapter } from './adapter.js';
import { DEX_PK_HISTORY, DEX_PK_SEARCH, normalizeDexPkNumber, parseDexPkHistory, parseDexPkSearch } from './parser.js';
import { dexPkStatus, statusMap } from './status.js';
import statuses from './statuses.json' with { type: 'json' };

const NUMBER = 'PKDEX900123456';
const PRINTED = 'PK-DEX900123456';
const fixture = (name: string): unknown => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'));
const search = () => fixture('search') as { data: Record<string, unknown>[] };
const history = () => fixture('history') as { data: { timeline: Record<string, unknown>[] } & Record<string, unknown> };
const json = (body: unknown, init: ResponseInit = {}) => new Response(typeof body === 'string' ? body : JSON.stringify(body),
  { ...init, headers: { 'Content-Type': 'application/json', ...init.headers } });
const environment = (fetcher: typeof fetch, recorder: StepRecorder = NOOP_RECORDER): AdapterEnvironment => ({
  fetcher, recorder, userAgent: 'synthetic-client/1', env: {}, trawl: null, browserExecutablePath: null,
});
const replying = () => vi.fn<typeof fetch>().mockImplementation(async (url) => json(url === DEX_PK_SEARCH ? search() : history()));

describe('DEX Pakistan number and routing', () => {
  it('keeps its existing detection rule and restores the official wire format', async () => {
    for (const raw of [NUMBER, PRINTED, 'pk dex 900123456']) {
      expect(normalizeDexPkNumber(raw)).toBe(PRINTED);
      expect(detectCarrierMatch(raw)).toMatchObject({ carrier: 'dex-pk', confidence: 'high' });
      // Its exclusive high-confidence format routes straight to the carrier.
      expect(recognitionCandidates(raw)).toEqual([]);
    }
    const fetcher = replying();
    for (const raw of ['PKDEX90012345', 'PKDEX9001234567', 'LXAD9001234567', '900123456', '']) {
      await expect(adapter(environment(fetcher)).track({ number: raw })).rejects.toThrow(InvalidInputError);
      await expect(adapter(environment(fetcher)).recognize!(raw)).resolves.toEqual({ known: false });
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('routes a normalized number through the native adapter with providers disabled', async () => {
    const fetcher = replying();
    const registry = new AdapterRegistry({ carriers: { 'dex-pk': 'dex-pk' }, factories: { 'dex-pk': adapter } }, environment(fetcher));
    const result = await createTracker({ registry, providers: [] }).track({ number: PRINTED });
    expect(result).toMatchObject({ carrier: 'dex-pk', source: 'dex-pk', attempts: [{ source: 'dex-pk', kind: 'ok' }] });
    expect(result.result.events).toHaveLength(4);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

describe('DEX Pakistan guest history', () => {
  it('uses the official two-request builder, host identity and supplied transport context', async () => {
    const fetcher = replying();
    await adapter(environment(fetcher)).track({ number: NUMBER }, { budgetMs: 2000 });
    expect(fetcher).toHaveBeenCalledTimes(2);
    const [lookup, detail] = fetcher.mock.calls;
    expect(lookup![0]).toBe(DEX_PK_SEARCH);
    expect(detail![0]).toBe(DEX_PK_HISTORY);
    expect(JSON.parse(String(lookup![1]!.body))).toEqual({ trackingNumbers: [PRINTED] });
    expect(JSON.parse(String(detail![1]!.body))).toEqual({ trackingNumber: PRINTED });
    for (const [, init] of fetcher.mock.calls) {
      expect(init).toMatchObject({ method: 'POST', cache: 'no-store', redirect: 'manual', headers: { 'User-Agent': 'synthetic-client/1' } });
      expect(init!.signal).toBeInstanceOf(AbortSignal);
    }
  });

  it('keeps every scan, its millisecond instant, reason and explicit stage without delivery images', () => {
    const result = parseDexPkHistory(history(), NUMBER);
    expect(result).toMatchObject({ status: 'delivered', current_stage: 'delivered', provider_code: 'domestic_delivered',
      destination_country: 'PK', last_update: '2026-01-01T09:00:00.123Z', delivered_at: '2026-01-01T09:00:00.123Z' });
    expect(result.events).toHaveLength(4);
    expect(result.events![3]!.time).toBe('2025-12-30T12:00:00.000Z');
    expect(result.events![2]).toMatchObject({ time: '2025-12-31T12:00:00.789Z', stage: 'failed_attempt',
      description: 'Unsuccessful delivery attempt: customer_unavailable', provider_code: 'domestic_1st_attempt_failed' });
    expect(JSON.stringify(result)).not.toMatch(/SYNTHETIC_PRIVATE|SYNTHETIC_RECIPIENT|recipientType|photos|epod|packageCode/);
    expect(isPartialAnswer(result)).toBe(false);
  });

  it('keeps empty and undated histories partial without inventing activity times', () => {
    const empty = history(); empty.data.timeline = [];
    const result = parseDexPkHistory(empty, NUMBER);
    expect(result).toMatchObject({ summary_only: true, events: [], last_update: null });
    expect(result.delivered_at).toBeUndefined();
    expect(isPartialAnswer(result)).toBe(true);
    const undated = history(); undated.data.timeline[0]!.processTime = null;
    const partial = parseDexPkHistory(undated, NUMBER);
    expect(partial.history_truncated).toBe(true);
    expect(partial.events![3]!.time).toBeUndefined();
    expect(isPartialAnswer(partial)).toBe(true);
  });

  it('keeps a newer summary while leaving its missing scan eligible for richer providers', () => {
    const missingCurrent = history(); missingCurrent.data.timeline.shift();
    const result = parseDexPkHistory(missingCurrent, NUMBER);
    expect(result).toMatchObject({ current_stage: 'delivered', provider_code: 'domestic_delivered',
      last_status_text: 'Delivered', last_update: '2026-01-01T07:00:00.456Z', history_truncated: true });
    expect(result.events).toHaveLength(3);
    expect(result.delivered_at).toBeUndefined();
    expect(result.events!.every((event) => event.stage !== 'delivered')).toBe(true);
    expect(isPartialAnswer(result)).toBe(true);
    expect(fillPartialAnswer('dex-pk', NUMBER, result, parseDexPkHistory(history(), NUMBER))?.events).toHaveLength(4);
  });

  it('keeps driver allocation at pending or prior registration after normalization and native routing', async () => {
    for (const code of ['driver_assigned', 'requesting_driver', 'need_review']) {
      const allocation = history(); allocation.data.status = code;
      allocation.data.timeline = [{ status: code, processTime: 1767258000123 }];
      expect(resolveResult(parseDexPkHistory(allocation, NUMBER))).toMatchObject({ status: 'pending', current_stage: 'pending',
        events: [{ stage: 'pending', stage_source: 'carrier_map' }] });
      const lookup = search(); lookup.data[0]!.packageStatus = code;
      const fetcher = vi.fn<typeof fetch>().mockImplementation(async (url) => json(url === DEX_PK_SEARCH ? lookup : allocation));
      const registry = new AdapterRegistry({ carriers: { 'dex-pk': 'dex-pk' }, factories: { 'dex-pk': adapter } }, environment(fetcher));
      const tracker = createTracker({ registry, providers: [] });
      expect((await tracker.track({ number: NUMBER })).result).toMatchObject({ status: 'pending', current_stage: 'pending',
        events: [{ stage: 'pending', stage_source: 'carrier_map' }] });
      allocation.data.timeline.push({ status: 'package_created', processTime: 1767250800456 });
      expect(resolveResult(parseDexPkHistory(allocation, NUMBER))).toMatchObject({ status: 'pending', current_stage: 'registered',
        events: [{ stage: 'pending' }, { stage: 'registered' }] });
      const result = await tracker.track({ number: NUMBER });
      expect(result.result).toMatchObject({ status: 'pending', current_stage: 'registered',
        events: [{ stage: 'pending' }, { stage: 'registered' }] });
      expect(result.result.events.some((event) => ['accepted', 'in_transit', 'out_for_delivery'].includes(event.stage))).toBe(false);
    }
  });

  it('accepts both official slash codes and distinguishes a failed pickup from a recipient delivery attempt', () => {
    for (const [code, stage] of [['domestic_pickup/sign_in_failure', 'exception'], ['domestic_pickup/sign_in_success', 'accepted']]) {
      const pickup = history(); pickup.data.status = code;
      pickup.data.timeline = [{ status: code, processTime: 1767258000123, reasonCode: 'synthetic_reason' }];
      const lookup = search(); lookup.data[0]!.packageStatus = code;
      expect(parseDexPkSearch(lookup, NUMBER).status).toBe(code);
      const result = resolveResult(parseDexPkHistory(pickup, NUMBER));
      expect(result).toMatchObject({ current_stage: stage, provider_code: code, events: [{ provider_code: code, stage }] });
      expect(result.events[0]!.stage).not.toBe('failed_attempt');
      expect(result.history_truncated).not.toBe(true);
    }
  });

  it('rejects another whole number, network or country and distinguishes unavailable history from not found', () => {
    for (const [key, value] of [['trackingNumber', `${PRINTED}0`], ['trackingNumber', { number: PRINTED }],
      ['destinationCountry', 'ID'], ['firstMileShippingProvider', 'ID-LEX']] as const) {
      const changed = history(); changed.data[key] = value;
      if (key === 'firstMileShippingProvider') changed.data.lastMileShippingProvider = 'ID-LEX';
      expect(() => parseDexPkHistory(changed, NUMBER)).toThrow();
    }
    const wrong = search(); wrong.data[0]!.trackingNumber = `${PRINTED}0`;
    expect(() => parseDexPkSearch(wrong, NUMBER)).toThrow(expect.objectContaining({ kind: 'indeterminate' }));
    expect(() => parseDexPkSearch({ success: true, data: [] }, NUMBER)).toThrow(expect.objectContaining({ kind: 'not_found' }));
    expect(() => parseDexPkHistory({ success: true }, NUMBER)).toThrow(expect.objectContaining({ kind: 'indeterminate' }));
    const malformed = history(); malformed.data.timeline[0]!.processTime = '2026-01-01';
    expect(() => parseDexPkHistory(malformed, NUMBER)).toThrow(expect.objectContaining({ kind: 'schema' }));
  });

  it('never retries HTTP rejections, challenges, schema drift or a confirmed missing package', async () => {
    for (const [response, kind] of [
      [json({ success: true, data: [] }), 'not_found'],
      [json({ success: false, data: [] }), 'schema'],
      [json('<html><title>Access Denied</title></html>'), 'challenge'],
      [json({ ret: ['FAIL_SYS_USER_VALIDATE'] }), 'challenge'],
      [json('<html><body>Unexpected page</body></html>'), 'schema'],
      [json('', { status: 302, headers: { Location: 'https://example.invalid/?private=synthetic' } }), 'transport'],
      [json('', { status: 404 }), 'transport'],
      [json('SYNTHETIC_PRIVATE_REPLY', { status: 429, headers: { 'Retry-After': '8' } }), 'rate_limited'],
      [json('SYNTHETIC_PRIVATE_REPLY', { status: 500 }), 'indeterminate'],
    ] as const) {
      const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => response.clone());
      await expect(adapter(environment(fetcher)).track({ number: NUMBER })).rejects.toMatchObject({ kind });
      expect(fetcher).toHaveBeenCalledTimes(1);
    }
  });

  it('retries only a network failure and removes raw diagnostics before recording recovery', async () => {
    const steps: StepRecord[] = [];
    const recorder = { step: (record: StepRecord) => { steps.push(record); }, lookup: vi.fn() };
    const fetcher = replying().mockRejectedValueOnce(new Error('SYNTHETIC_PRIVATE_CAUSE'));
    await adapter(environment(fetcher, recorder)).track({ number: NUMBER });
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(steps).toMatchObject([{ step: 'direct', outcome: 'transport' }, { step: 'retry', outcome: 'ok', fallbackFrom: 'direct' }]);
    expect(steps[0]!.error).toBeInstanceOf(UpstreamNetworkError);
    expect(steps[0]!.error).not.toHaveProperty('cause');
    expect(steps[0]!.error).not.toHaveProperty('request', expect.anything());
    expect(JSON.stringify(steps)).not.toContain('SYNTHETIC_PRIVATE');
    const rejectedSteps: StepRecord[] = [];
    const rejected = vi.fn<typeof fetch>().mockResolvedValue(json('SYNTHETIC_PRIVATE_REPLY', { status: 429,
      headers: { 'Retry-After': '8', 'Set-Cookie': 'private=SYNTHETIC_PRIVATE_COOKIE' } }));
    await expect(adapter(environment(rejected, { step: (record) => { rejectedSteps.push(record); }, lookup() {} }))
      .track({ number: NUMBER })).rejects.toMatchObject({ kind: 'rate_limited', status: 429, retryAfterMs: 8000 });
    expect(rejectedSteps[0]!.error).not.toHaveProperty('diagnostics', expect.anything());
    expect(rejectedSteps[0]!.error).not.toHaveProperty('request', expect.anything());
    expect(JSON.stringify(rejectedSteps)).not.toContain('SYNTHETIC_PRIVATE');
  });

  it('passes cancellation to each request and starts no retry after cancellation', async () => {
    for (const abortAt of [DEX_PK_SEARCH, DEX_PK_HISTORY]) {
      const controller = new AbortController();
      const steps: StepRecord[] = [];
      const fetcher = vi.fn<typeof fetch>().mockImplementation(async (url, init) => {
        if (url === abortAt) {
          controller.abort(new Error('SYNTHETIC_PRIVATE_CANCELLATION'));
          if (url === DEX_PK_HISTORY) init!.signal!.throwIfAborted();
        }
        return json(url === DEX_PK_SEARCH ? search() : history());
      });
      await expect(adapter(environment(fetcher, { step: (record) => { steps.push(record); }, lookup() {} }))
        .track({ number: NUMBER }, { signal: controller.signal })).rejects.toThrow();
      expect(fetcher).toHaveBeenCalledTimes(abortAt === DEX_PK_SEARCH ? 1 : 2);
      expect(fetcher.mock.calls.at(-1)![1]!.signal!.aborted).toBe(true);
      expect(JSON.stringify(steps)).not.toContain('SYNTHETIC_PRIVATE');
    }
    const stopped = new AbortController();
    const reason = Object.assign(new Error('SYNTHETIC_PRIVATE_CANCELLATION'), { request: { url: 'https://example.invalid/private' } });
    stopped.abort(reason);
    const recorder = { step: vi.fn(), lookup: vi.fn() };
    const unused = replying();
    await expect(adapter(environment(unused, recorder)).track({ number: NUMBER }, { signal: stopped.signal })).rejects.toBe(reason);
    expect(unused).not.toHaveBeenCalled();
    expect(recorder.lookup).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(recorder.lookup.mock.calls)).not.toMatch(/SYNTHETIC_PRIVATE|example.invalid/);
  });

  it('recognizes dated history and does not turn a transport failure into an unknown number', async () => {
    await expect(adapter(environment(replying())).recognize!(NUMBER)).resolves.toMatchObject({ known: true, lastActivityAt: '2026-01-01T09:00:00.123Z' });
    const absent = vi.fn<typeof fetch>().mockResolvedValue(json({ success: true, data: [] }));
    await expect(adapter(environment(absent)).recognize!(NUMBER)).resolves.toEqual({ known: false });
    const failed = vi.fn<typeof fetch>().mockResolvedValue(json('', { status: 503 }));
    await expect(adapter(environment(failed)).recognize!(NUMBER)).rejects.toMatchObject({ kind: 'maintenance' });
  });
});

it('maps status codes independently of wording and leaves unsupported progress visible', () => {
  for (const { code, wording, stage } of statuses.entries) {
    expect(dexPkStatus(code)).toEqual({ title: wording, stage });
    expect(statusMap.stage(code, 'synthetic wording')).toBe(stage);
  }
  expect(statusMap.stage(null, 'Delivered')).toBeUndefined();
  expect(dexPkStatus('driver_assigned')).toEqual({ title: 'Driver assigned', stage: 'pending' });
  expect(dexPkStatus('domestic_synthetic_unknown')).toBeUndefined();
  const unknown = history(); unknown.data.status = 'domestic_synthetic_unknown';
  expect(parseDexPkHistory(unknown, NUMBER)).toMatchObject({ status: 'unknown', last_status_text: 'domestic_synthetic_unknown' });
});
