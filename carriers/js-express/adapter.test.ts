import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { statusMapAnswer } from '../../core/catalog/statusMaps.js';
import { detectCarrierMatch } from '../../core/detection/index.js';
import { normalizeStatusWording } from '../../core/status/statusMap.js';
import { NOOP_RECORDER } from '../../core/telemetry/index.js';
import { createTracker } from '../../facade/index.js';
import { adapter, JS_EXPRESS_TRACKER, JsExpressTracker } from './adapter.js';
import { jsExpressScan, normalizeJsExpressNumber, parseJsExpress } from './parser.js';
import { jsExpressMappedStage, jsExpressStage, statusMap } from './status.js';
import statuses from './statuses.json' with { type: 'json' };

const DELIVERED = 'JSEZZ0000000001YQ';
const IN_TRANSIT = 'JSEZZ0000000002YQ';
const UNKNOWN = 'JSEZZ0000000003YQ';
const page = (name: string) => readFileSync(new URL(`./fixtures/${name}.html`, import.meta.url), 'utf8');
const reply = (body: string, status = 200) => new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
const carrier = (fetcher: typeof fetch) => adapter({ fetcher, recorder: NOOP_RECORDER, env: {}, trawl: null, browserExecutablePath: null });
// One history row, as the page writes it.
const row = (time: string, place: string, wording: string) =>
  `<li><div><p class="time">${time}</p><p class="addr">【${place}】<span>${wording}</span></p></div></li>`;
// The not-found page with its answer replaced, for the delivered fixture's number.
const withList = (list: string) => page('not-found').replace(UNKNOWN, DELIVERED).replace('未获取到任何数据,请提供有效单号!', list);
const CLOUDFLARE = '<!DOCTYPE html><html><head><title>Just a moment...</title></head><body><script>window._cf_chl_opt={};</script></body></html>';

describe('JS Express tracking adapter', () => {
  it('posts the whole number to the tracking page once, as the home page\'s form does, through the supplied transport', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(reply(page('delivered')));
    const recorder = { ...NOOP_RECORDER, step: vi.fn(), lookup: vi.fn() };
    await expect(new JsExpressTracker({ fetcher, recorder, userAgent: 'SyntheticHost/1.0' }).fetch(' jsezz 0000000001 yq ', { budgetMs: 1000.5 }))
      .resolves.toMatchObject({ status: 'delivered' });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0]!;
    expect(String(url)).toBe(JS_EXPRESS_TRACKER);
    expect(init).toMatchObject({ method: 'POST', redirect: 'manual', signal: expect.any(AbortSignal), body: `card_num=${DELIVERED}`,
      headers: { Accept: 'text/html,application/xhtml+xml', 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'SyntheticHost/1.0' } });
    expect(recorder.step).toHaveBeenCalledWith(expect.objectContaining({ carrier: 'js-express', step: 'direct', outcome: 'ok' }));
    expect(recorder.lookup).toHaveBeenCalledTimes(1);
  });

  it('reads a parcel delivered abroad in the page\'s order, with wall clocks and the courier\'s place as the location', () => {
    const result = parseJsExpress(page('delivered'), DELIVERED);
    expect(result).toMatchObject({ status: 'delivered', current_stage: 'delivered', current_stage_source: 'carrier_map',
      last_status_text: 'Delivered', last_update: null, last_update_local: '2026-03-12T20:41:05', expected_delivery: null });
    expect(result.events!.map(event => [event.local_time, event.location, event.description, event.stage])).toEqual([
      ['2026-03-12T20:41:05', 'Sample Town, ON', 'Delivered', 'delivered'],
      // A forecast is no scan.
      ['2026-03-12T11:20:44', 'Sample Town, ON', 'Package will be delivered before 9:00pm', undefined],
      ['2026-03-12T08:02:13', 'Sample City, ON', 'Package is received at a Straightship station', 'in_transit'],
      ['2026-03-11T17:45:30', 'Sample Hub, ON', 'Package is received at a Straightship station', 'in_transit'],
      ['2026-03-11T17:45:30', 'Sample Hub, ON', 'Package Received with Origin Scan warehouse', 'in_transit'],
      ['2026-03-09T18:10:09', 'YYZ', 'Delivery to local courier', 'in_transit'],
      ['2026-03-09T12:31:52', 'YYZ', 'Released From Import Customs', 'in_transit'],
      ['2026-03-09T05:02:40', 'YYZ', 'The goods have been picked up abroad', 'in_transit'],
      ['2026-03-08T03:40:11', 'YYZ', 'NOA-Notification of arrival from GHA', 'in_transit'],
      ['2026-03-07T19:55:26', 'YYZ', 'Item Flight landing', 'in_transit'],
      ['2026-03-07T12:14:37', 'YVR', 'Connecting flights flight takeoff', 'in_transit'],
      // Clocks of different countries: the page's order stands.
      ['2026-03-07T10:20:15', 'China', 'Item Flight departure', 'in_transit'],
      ['2026-03-07T05:31:48', 'YVR', 'Initial landing', 'in_transit'],
      ['2026-03-05T21:10:00', 'China', 'Released From Export Customs', 'in_transit'],
      ['2026-03-05T19:10:00', 'China', 'Arrive at international airport to abroad', 'in_transit'],
      ['2026-03-05T09:12:30', 'South China Transit Center', 'Item departed from origin.', 'in_transit'],
      // The row the page lists twice is kept once.
      ['2026-03-04T15:01:22', 'Sample General Warehouse-Operation Center', 'Item outbound in sorting center.', 'in_transit'],
      ['2026-03-04T03:22:05', 'Sample General Warehouse-Operation Center', 'Item inbound in sorting center.', 'in_transit'],
      ['2026-03-04T03:10:47', 'Sample General Warehouse-Operation Center', 'Item has been collected', 'accepted'],
      // A partner's record of the data moves nothing; an empty 【】 names no place.
      ['2026-03-03T19:40:02', undefined, 'Package information is created in the system', undefined],
      ['2026-03-03T08:15:33', 'Sample General Warehouse-Operation Center', 'Electronic notification of order creation received.', 'registered'],
    ]);
    expect(result.events!.every(event => event.time === undefined)).toBe(true);
    expect(result.events!.filter(event => event.stage).every(event => event.stage_source === 'carrier_map')).toBe(true);
    expect(result).not.toHaveProperty('delivered_at');
  });

  it('reads a parcel announced at the destination airport', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(reply(page('in-transit')));
    const result = await carrier(fetcher).track({ number: IN_TRANSIT });
    expect(result).toMatchObject({ status: 'in_transit', current_stage: 'in_transit', current_stage_source: 'carrier_map',
      last_status_text: 'NOA-Notification of arrival from GHA', last_update_local: '2026-04-16T06:12:00' });
    expect(result.events).toHaveLength(16);
    expect(result.events!.slice(0, 3)).toEqual([
      { local_time: '2026-04-16T06:12:00', location: 'AMS', description: 'NOA-Notification of arrival from GHA', stage: 'in_transit', stage_source: 'carrier_map' },
      { local_time: '2026-04-15T22:30:00', location: 'AMS', description: 'Item Flight landing', stage: 'in_transit', stage_source: 'carrier_map' },
      { local_time: '2026-04-15T22:30:00', location: 'AMSTERDAM', description: 'ARRIVED AT DESTINATION AIRPORT', stage: 'in_transit', stage_source: 'carrier_map' },
    ]);
    expect(result.events!.find(event => event.description === 'SHIPPING INFORMATION RECEIVED')).toEqual(
      { local_time: '2026-04-15T10:44:18', description: 'SHIPPING INFORMATION RECEIVED' });
    expect(result.events!.at(-1)).toMatchObject({ location: 'China, Transit Center', stage: 'registered' });
    expect(fetcher.mock.calls[0]![1]!.body).toBe(`card_num=${IN_TRANSIT}`);
  });

  it('moves a courier\'s place into the location and drops who took a delivery and phone numbers', () => {
    expect(jsExpressScan('Delivered (Sample Town, ON)', 'Sample Town')).toEqual({ description: 'Delivered', location: 'Sample Town, ON' });
    // A place the label does not name stays in the wording.
    expect(jsExpressScan('Held at depot (weekend)', 'Sample Town')).toEqual({ description: 'Held at depot (weekend)', location: 'Sample Town' });
    expect(jsExpressScan('Delivered (Sample Town, ON)', '')).toEqual({ description: 'Delivered (Sample Town, ON)', location: '' });
    expect(jsExpressScan('Delivered, signed by A SAMPLE PERSON', 'Sample Town').description).toBe('Delivered');
    expect(jsExpressScan('Delivered - received by A SAMPLE PERSON (Sample Town, ON)', 'Sample Town').description).toBe('Delivered');
    expect(jsExpressScan('Delivered Signature: SAMPLE', 'Sample Town').description).toBe('Delivered');
    expect(jsExpressScan('Delivery attempted, call +1 555 000 0000', 'Sample Town').description).toBe('Delivery attempted, call');
    // Only a delivery's wording loses a "by" clause.
    expect(jsExpressScan('Picked up by the airline', 'HKG').description).toBe('Picked up by the airline');
  });

  it('stages new wording through the shared rules and keeps the rest without a stage', () => {
    const one = (wording: string) => parseJsExpress(withList(row('2026-05-01 09:00:00', 'Sample Town', wording)), DELIVERED);
    expect(one('Out for delivery')).toMatchObject({ status: 'out_for_delivery', current_stage: 'out_for_delivery' });
    const unknown = one('Sample counter scan');
    expect(unknown).toMatchObject({ status: 'unknown', last_status_text: 'Sample counter scan', last_update_local: '2026-05-01T09:00:00' });
    expect(unknown.current_stage).toBeUndefined();
    expect(unknown.events).toEqual([{ local_time: '2026-05-01T09:00:00', location: 'Sample Town', description: 'Sample counter scan' }]);
    // A partner's record of the data is the newest row: the older scan sets the stage.
    const recorded = parseJsExpress(withList(row('2026-05-01 10:00:00', '', 'SHIPMENT CREATED')
      + row('2026-05-01 09:00:00', 'Sample Center', 'Item has been collected')), DELIVERED);
    expect(recorded).toMatchObject({ status: 'in_transit', current_stage: 'accepted', last_status_text: 'SHIPMENT CREATED' });
  });

  it('reads the page\'s "no data" answer as not found, and an empty answer as inconclusive', async () => {
    expect(() => parseJsExpress(page('not-found'), UNKNOWN)).toThrow(expect.objectContaining({ kind: 'not_found' }));
    expect(() => parseJsExpress(withList('暂无轨迹数据'), DELIVERED)).toThrow(expect.objectContaining({ kind: 'indeterminate', name: 'NoHistoryError' }));
    expect(() => parseJsExpress(withList(' '), DELIVERED)).toThrow(expect.objectContaining({ kind: 'indeterminate' }));
    expect(() => parseJsExpress(withList('验证码错误，请重新输入'), DELIVERED)).toThrow(expect.objectContaining({ kind: 'challenge' }));
    expect(() => parseJsExpress(withList('Sample service notice'), DELIVERED)).toThrow(expect.objectContaining({ kind: 'schema' }));
    const lookup = (body: string, number = UNKNOWN) => carrier(vi.fn<typeof fetch>().mockResolvedValue(reply(body))).track({ number });
    await expect(lookup(page('not-found'))).rejects.toMatchObject({ kind: 'not_found' });
    await expect(lookup('  ')).rejects.toMatchObject({ kind: 'indeterminate' });
    await expect(lookup(CLOUDFLARE)).rejects.toMatchObject({ kind: 'challenge' });
    await expect(lookup('<html><body>Sample maintenance page</body></html>')).rejects.toMatchObject({ kind: 'schema' });
    // The page carries the captcha dialog and Cloudflare's script with every answer.
    await expect(lookup(page('delivered'), DELIVERED)).resolves.toMatchObject({ status: 'delivered' });
  });

  it('binds the page to the whole requested number and rejects a changed page', () => {
    expect(() => parseJsExpress(page('delivered'), 'JSEZZ0000000009YQ'))
      .toThrow(expect.objectContaining({ kind: 'schema', message: 'JS Express answered for another waybill' }));
    expect(parseJsExpress(page('delivered').replace(`value="${DELIVERED}"`, `value="${DELIVERED.toLowerCase()}"`), DELIVERED).events).toHaveLength(21);
    // A page that lost the number did not answer the form.
    expect(() => parseJsExpress(page('delivered').replace(`value="${DELIVERED}"`, 'value=""'), DELIVERED))
      .toThrow(expect.objectContaining({ kind: 'indeterminate' }));
    const delivered = page('delivered');
    for (const changed of [
      delivered.replace('id="card_num"', 'id="waybill"'),
      delivered.replace('class="cxlistbox clearfix"', 'class="results"'),
      delivered.replace('<form', `<input id="card_num" value="${DELIVERED}"><form`),
      delivered.replace('2026-03-12 20:41:05', '12/03/2026 20:41'),
      delivered.replace('2026-03-12 20:41:05', '2026-02-30 20:41:05'),
      delivered.replace('2026-03-12 20:41:05', '2026-03-12 24:00:00'),
      delivered.replace('<p class="addr">【Sample Town】<span>Delivered (Sample Town, ON)</span>', '<p class="addr">Sample Town <span>Delivered</span>'),
      delivered.replace('<span>Delivered (Sample Town, ON)</span>', '<span> </span>'),
      delivered.replace('<p class="time">2026-03-12 20:41:05</p>', ''),
    ]) {
      expect(() => parseJsExpress(changed, DELIVERED)).toThrow(expect.objectContaining({ kind: 'schema' }));
    }
    const long = Array.from({ length: 501 }, () => row('2026-05-01 09:00:00', 'Sample Town', 'Item Flight landing')).join('');
    expect(() => parseJsExpress(withList(long), DELIVERED)).toThrow(expect.objectContaining({ kind: 'schema' }));
  });

  it('keeps the newest hundred rows of a long history and says it cut the rest', () => {
    const rows = Array.from({ length: 120 }, (_, index) =>
      row(`2026-05-01 ${String(Math.floor((119 - index) / 60)).padStart(2, '0')}:${String((119 - index) % 60).padStart(2, '0')}:00`, 'Sample Hub', 'Item Flight landing'));
    const result = parseJsExpress(withList(rows.join('')), DELIVERED);
    expect(result.events).toHaveLength(100);
    expect(result).toMatchObject({ history_truncated: true, last_update_local: '2026-05-01T01:59:00' });
  });

  it('takes JS Express waybills, and nothing else, without a request', async () => {
    const fetcher = vi.fn<typeof fetch>();
    for (const number of ['JSEZZ000000001YQ', 'JSEZZ00000000001YQ', 'JSEZZ0000000001YR', 'FEISH0000000001YQ', 'WNBZZ0000000001YQ',
      'JSE0000000000001YQ', '12345678901', `JSEZZ${'0'.repeat(70)}YQ`]) {
      await expect(carrier(fetcher).track({ number }), number).rejects.toMatchObject({ kind: 'invalid_input' });
      await expect(carrier(fetcher).recognize!(number)).resolves.toEqual({ known: false });
    }
    expect(fetcher).not.toHaveBeenCalled();
    expect(normalizeJsExpressNumber(' jsezz-0000 0000 01 yq ')).toBe(DELIVERED);
  });

  it('recognizes a known parcel and an unknown number from plain HTTP', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(reply(page('delivered'))).mockResolvedValueOnce(reply(page('not-found')));
    // Wall clocks cannot date the parcel's last activity.
    await expect(carrier(fetcher).recognize!(DELIVERED)).resolves.toEqual({ known: true, lastActivityAt: null });
    await expect(carrier(fetcher).recognize!(UNKNOWN)).resolves.toEqual({ known: false });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it.each([[403, 'challenge'], [429, 'rate_limited'], [302, 'indeterminate'], [404, 'transport'], [410, 'transport'],
    [500, 'indeterminate'], [503, 'maintenance']] as const)(
    'keeps HTTP %s as %s during retrieval and recognition, without a retry', async (status, kind) => {
      const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => reply(page('not-found'), status));
      await expect(carrier(fetcher).track({ number: DELIVERED })).rejects.toMatchObject({ kind });
      await expect(carrier(fetcher).recognize!(DELIVERED)).rejects.toMatchObject({ kind });
      expect(fetcher).toHaveBeenCalledTimes(2);
    });

  it('tries once more after a failed connection, inside the caller\'s budget', async () => {
    const flaky = vi.fn<typeof fetch>().mockRejectedValueOnce(new TypeError('fetch failed')).mockResolvedValueOnce(reply(page('delivered')));
    await expect(carrier(flaky).track({ number: DELIVERED })).resolves.toMatchObject({ status: 'delivered' });
    expect(flaky).toHaveBeenCalledTimes(2);
    const immediate = vi.fn<typeof fetch>().mockResolvedValue(reply(page('delivered')));
    await expect(carrier(immediate).track({ number: DELIVERED }, { signal: AbortSignal.abort(new Error('cancelled')) })).rejects.toThrow('cancelled');
    await expect(carrier(immediate).track({ number: DELIVERED }, { budgetMs: 0 })).rejects.toMatchObject({ kind: 'budget' });
    expect(immediate).not.toHaveBeenCalled();
    const slow = vi.fn<typeof fetch>((_input, init) => new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal!.reason), { once: true });
    }));
    await expect(carrier(slow).track({ number: DELIVERED }, { budgetMs: 20.5 }))
      .rejects.toMatchObject({ kind: expect.stringMatching(/^(?:transport|budget)$/) });
    expect(slow.mock.calls.length).toBeLessThanOrEqual(2);
    expect(slow.mock.calls.every(([, init]) => init?.signal?.aborted)).toBe(true);
    const large = vi.fn<typeof fetch>().mockResolvedValue(new Response(new Uint8Array(1024 * 1024 + 1)));
    await expect(carrier(large).track({ number: DELIVERED })).rejects.toThrow('unexpectedly large');
  });

  it('routes a JS Express waybill, which detection settles, to the adapter', async () => {
    expect(detectCarrierMatch(DELIVERED)).toMatchObject({ carrier: 'js-express', confidence: 'high' });
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => reply(page('delivered')));
    const answer = await createTracker({ fetcher, providers: [], env: {} }).track({ number: DELIVERED }, { budgetMs: 3000 });
    expect(answer).toMatchObject({ carrier: 'js-express', source: 'js-express', result: { current_stage: 'delivered' } });
    expect(fetcher.mock.calls.every(([url]) => String(url) === JS_EXPRESS_TRACKER)).toBe(true);
  });
});

describe('JS Express status vocabulary', () => {
  it('maps every wording it recorded to the stage recorded for it, and leaves records of data and forecasts out', () => {
    for (const entry of statuses.entries) {
      const wording = normalizeStatusWording(entry.wording);
      if (!('stage' in entry)) {
        expect(statusMap.stage(null, wording), entry.wording).toBeUndefined();
        expect(statusMapAnswer({ carrier: 'js-express', description: entry.wording }), entry.wording).toMatchObject({ kind: 'intentional_gap' });
        expect(jsExpressStage(entry.wording), entry.wording).toBeNull();
        continue;
      }
      expect(jsExpressMappedStage(entry.wording), entry.wording).toBe(entry.stage);
      expect(statusMap.stage(null, wording), entry.wording).toBe(entry.stage);
      expect(statusMapAnswer({ carrier: 'js-express', description: entry.wording }), entry.wording).toEqual({ kind: 'mapped', stage: entry.stage });
      expect(jsExpressStage(entry.wording), entry.wording).toEqual({ stage: entry.stage, source: 'carrier_map' });
    }
    expect(statusMap.gaps.every(gap => gap.wording && gap.note)).toBe(true);
    for (const wording of ['constructor', 'toString', 'Sample delivered note']) expect(jsExpressMappedStage(wording), wording).toBeUndefined();
    expect(statusMap.stage('7', 'delivered')).toBeUndefined();
    expect(jsExpressStage('')).toBeNull();
  });
});
