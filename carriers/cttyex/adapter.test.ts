import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { statusMapAnswer } from '../../core/catalog/statusMaps.js';
import { detectCarrierMatch } from '../../core/detection/index.js';
import { normalizeStatusWording } from '../../core/status/statusMap.js';
import { NOOP_RECORDER } from '../../core/telemetry/index.js';
import { createTracker } from '../../facade/index.js';
import { adapter, CTTYEX_API, CttyexTracker } from './adapter.js';
import { normalizeCttyexNumber, parseCttyex } from './parser.js';
import { cttyexStage, statusMap } from './status.js';
import statuses from './statuses.json' with { type: 'json' };

const UNKNOWN = 'CTTY9900000001CN';
const IN_TRANSIT = 'CTTY9900000002CN';
const REGISTERED = 'CTTY9900000003CN';

type Row = Record<string, unknown>;
type Item = Row & { details: Row[] };

const fixture = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8')) as Item[];
const changed = (name: string, change: (item: Item, reply: Item[]) => void) => {
  const reply = fixture(name);
  change(reply[0]!, reply);
  return reply;
};
// The tracker answers with JSON labelled as an HTML page.
const reply = (body: unknown, init: ResponseInit = {}) => new Response(typeof body === 'string' ? body : JSON.stringify(body),
  { ...init, headers: { 'Content-Type': 'text/html; charset=utf-8', ...init.headers } });
const carrier = (fetcher: typeof fetch) => adapter({ fetcher, recorder: NOOP_RECORDER, env: {}, trawl: null, browserExecutablePath: null });

describe('CTTYEX HTTP adapter', () => {
  it('asks the tracking page’s lookup for the whole number in capitals, through the supplied transport', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(reply(fixture('in-transit')));
    const recorder = { ...NOOP_RECORDER, step: vi.fn(), lookup: vi.fn() };
    await expect(new CttyexTracker({ fetcher, recorder, userAgent: 'SyntheticHost/1.0' }).fetch(' ctty 9900-0000-02 cn ', { budgetMs: 1000.5 }))
      .resolves.toMatchObject({ current_stage: 'in_transit' });
    expect(fetcher).toHaveBeenCalledOnce();
    const [[url, init]] = fetcher.mock.calls as [[string, RequestInit]];
    expect(String(url)).toBe(`${CTTYEX_API}?nos=${IN_TRANSIT}`);
    expect(init).toMatchObject({ method: 'GET', redirect: 'manual', signal: expect.any(AbortSignal),
      headers: { Accept: 'application/json', 'Accept-Language': 'zh-CN', 'User-Agent': 'SyntheticHost/1.0' } });
    expect(recorder.step).toHaveBeenCalledWith(expect.objectContaining({ carrier: 'cttyex', step: 'direct', outcome: 'ok' }));
    expect(recorder.lookup).toHaveBeenCalledTimes(1);
  });

  it('reads CTTYEX’s steps in China on Beijing time and stages them by their wording', () => {
    const result = parseCttyex(fixture('in-transit'), IN_TRANSIT);
    expect(result).toMatchObject({ status: 'in_transit', current_stage: 'in_transit', current_stage_source: 'carrier_map',
      last_status_text: 'Departure from the airport of origin domestic', last_update: '2026-03-21T01:10:20+08:00',
      last_update_local: null, expected_delivery: null, destination_country: 'DE' });
    // The repeated scan is kept once.
    expect(result.events!.map((event) => [event.time, event.stage, event.stage_source])).toEqual([
      ['2026-03-21T01:10:20+08:00', 'in_transit', 'carrier_map'],
      ['2026-03-19T22:40:05+08:00', 'in_transit', 'carrier_map'],
      ['2026-03-18T08:15:30+08:00', 'in_transit', 'carrier_map'],
      ['2026-03-15T21:05:45+08:00', 'accepted', 'carrier_map'],
      ['2026-03-15T11:30:00+08:00', 'registered', 'carrier_map'],
    ]);
    expect(result.events!.every((event) => event.local_time === undefined && event.location === undefined)).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/中国|天/);
  });

  it('takes the order data alone as a registration, whatever the summary says', () => {
    expect(parseCttyex(fixture('registered'), REGISTERED)).toMatchObject({ status: 'pending', current_stage: 'registered',
      current_stage_source: 'carrier_map', last_update: '2026-04-02T14:20:10+08:00', destination_country: 'FR' });
  });

  it('keeps the wall clock of a wording the map does not list, which could come from another leg', () => {
    const result = parseCttyex(changed('in-transit', (item) => {
      item.details.unshift({ create_time: '2026-03-23 09:45:00', content: 'Delivered' }, { create_time: '2026-03-22 18:00:00', content: 'Synthetic note' });
    }), IN_TRANSIT);
    expect(result).toMatchObject({ status: 'delivered', current_stage: 'delivered', current_stage_source: 'wording:language',
      last_update: null, last_update_local: '2026-03-23T09:45:00' });
    expect(result.events!.slice(0, 3)).toEqual([
      { local_time: '2026-03-23T09:45:00', description: 'Delivered', stage: 'delivered', stage_source: 'wording:language' },
      { local_time: '2026-03-22T18:00:00', description: 'Synthetic note' },
      expect.objectContaining({ time: '2026-03-21T01:10:20+08:00' }),
    ]);
  });

  it('takes the summary’s status when no scan has a stage, and drops the markup the page would render', () => {
    const result = parseCttyex(changed('registered', (item) => {
      item.details = [{ create_time: '2026-04-02 14:20:10', content: 'Synthetic <b>note</b>' }];
    }), REGISTERED);
    expect(result).toMatchObject({ status: 'in_transit', current_stage: 'in_transit', current_stage_source: 'carrier_map',
      last_status_text: 'Synthetic note' });
    expect(parseCttyex(changed('registered', (item) => { item.status = '同步中'; item.details[0]!.content = 'Synthetic note'; }), REGISTERED))
      .toMatchObject({ status: 'unknown' });
  });

  it('keeps a destination it cannot name as the tracker writes it, and none when it gives none', () => {
    expect(parseCttyex(changed('registered', (item) => { item.toCountry = '样例国'; }), REGISTERED))
      .toMatchObject({ destination_country_name: '样例国' });
    expect(parseCttyex(changed('registered', (item) => { item.toCountry = '中国香港'; }), REGISTERED))
      .toMatchObject({ destination_country: 'HK' });
    // The tracker names countries in English for a lookup asked in English.
    expect(parseCttyex(changed('registered', (item) => { item.toCountry = 'Germany'; }), REGISTERED))
      .toMatchObject({ destination_country: 'DE' });
    const blank = parseCttyex(changed('registered', (item) => { item.toCountry = ''; }), REGISTERED);
    expect(blank).not.toHaveProperty('destination_country');
    expect(blank).not.toHaveProperty('destination_country_name');
  });

  it('reads a history listed oldest first newest first, as the page shows it', () => {
    const result = parseCttyex(changed('in-transit', (item) => { item.details.reverse(); }), IN_TRANSIT);
    expect(result).toMatchObject({ last_update: '2026-03-21T01:10:20+08:00', current_stage: 'in_transit' });
    expect(result.events!.at(-1)).toMatchObject({ description: 'Order information received' });
  });

  it('reads only the tracker’s unknown-number answer as not found, and a record without scans as no history', () => {
    expect(() => parseCttyex(fixture('not-found'), UNKNOWN)).toThrow(expect.objectContaining({ kind: 'not_found' }));
    // The same answer from a lookup asked in English.
    expect(() => parseCttyex(changed('not-found', (item) => { item.status = 'Not Found'; }), UNKNOWN))
      .toThrow(expect.objectContaining({ kind: 'not_found' }));
    expect(() => parseCttyex(changed('in-transit', (item) => { item.details = []; }), IN_TRANSIT))
      .toThrow(expect.objectContaining({ kind: 'indeterminate', name: 'NoHistoryError' }));
    // The answer to a lookup without a number.
    expect(() => parseCttyex({ success: false, msg: '查询单号不能为空' }, UNKNOWN)).toThrow(expect.objectContaining({ kind: 'indeterminate' }));
    expect(() => parseCttyex(changed('not-found', (item) => { item.details = fixture('in-transit')[0]!.details; }), UNKNOWN))
      .toThrow(expect.objectContaining({ kind: 'schema' }));
  });

  it('counts a parcel only when it names the number asked', () => {
    expect(() => parseCttyex(fixture('in-transit'), REGISTERED))
      .toThrow(expect.objectContaining({ kind: 'indeterminate', message: 'CTTYEX answered for another shipment' }));
    expect(() => parseCttyex(fixture('not-found'), IN_TRANSIT))
      .toThrow(expect.objectContaining({ kind: 'indeterminate', message: 'CTTYEX answered for another shipment' }));
    // The tracker matches capitals only, so a parcel echoed in lower case is another lookup.
    expect(() => parseCttyex(changed('in-transit', (item) => { item.no = IN_TRANSIT.toLowerCase(); }), IN_TRANSIT))
      .toThrow(expect.objectContaining({ kind: 'indeterminate' }));
  });

  it('rejects a changed reply', () => {
    for (const change of [
      (_item: Item, body: Item[]) => { body.length = 0; },
      (item: Item, body: Item[]) => { body.push({ ...item }); },
      (_item: Item, body: Item[]) => { body[0] = 'parcel' as never; },
      (item: Item) => { delete item.no; },
      (item: Item) => { item.no = 7; },
      (item: Item) => { item.status = ['运输途中'] as never; },
      (item: Item) => { item.details = 'details' as never; },
      (item: Item) => { delete (item as Row).details; },
      (item: Item) => { item.details = Array.from({ length: 201 }, () => item.details[0]!); },
      (item: Item) => { item.details[0] = 'scan' as never; },
      (item: Item) => { item.details[0]!.create_time = '2026/03/21 01:10:20'; },
      (item: Item) => { item.details[0]!.create_time = '2026-03-21 01:10'; },
      (item: Item) => { item.details[0]!.create_time = '2026-02-30 01:10:20'; },
      (item: Item) => { item.details[0]!.create_time = '2026-03-21 24:00:00'; },
      (item: Item) => { item.details[0]!.content = 'Delivered'; item.details[0]!.create_time = '2026-02-30 01:10:20'; },
      (item: Item) => { delete item.details[0]!.create_time; },
      (item: Item) => { item.details[0]!.content = ['Departure']; },
      (item: Item) => { item.details[0]!.content = ' '; },
      (item: Item) => { item.toCountry = { name: '德国' }; },
    ]) {
      expect(() => parseCttyex(changed('in-transit', change), IN_TRANSIT)).toThrow(expect.objectContaining({ kind: 'schema' }));
    }
  });

  it('keeps an unknown number, a moved route, a browser check and a broken reply apart', async () => {
    const lookup = (body: unknown, init?: ResponseInit) => carrier(vi.fn<typeof fetch>().mockResolvedValue(reply(body, init))).track({ number: UNKNOWN });
    await expect(lookup(fixture('not-found'))).rejects.toMatchObject({ kind: 'not_found' });
    // The lookup answers every number with HTTP 200: a 404 or a redirect is a moved route.
    await expect(lookup(fixture('not-found'), { status: 404 })).rejects.toMatchObject({ kind: 'transport' });
    await expect(lookup('', { status: 302, headers: { Location: 'https://www.cttyvip888.com/' } })).rejects.toMatchObject({ kind: 'transport' });
    // Alibaba Cloud's firewall checks a browser with a script that sets a cookie, with HTTP 200.
    await expect(lookup('<html><script>var arg1=\'00\';document.cookie="acw_sc__v2=00"</script></html>'))
      .rejects.toMatchObject({ kind: 'challenge' });
    await expect(lookup('<!DOCTYPE html><html><head><title>Just a moment...</title></head><body><script>window._cf_chl_opt={}</script></body></html>'))
      .rejects.toMatchObject({ kind: 'challenge' });
    await expect(lookup('<html><title>系统发生错误</title></html>')).rejects.toMatchObject({ kind: 'schema' });
    await expect(lookup('')).rejects.toMatchObject({ kind: 'schema' });
  });

  it.each([[403, 'challenge'], [429, 'rate_limited'], [500, 'indeterminate'], [502, 'indeterminate'], [503, 'maintenance']] as const)(
    'preserves HTTP %s as %s during retrieval and recognition', async (status, kind) => {
      const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => new Response('', { status }));
      await expect(carrier(fetcher).track({ number: IN_TRANSIT })).rejects.toMatchObject({ kind });
      await expect(carrier(fetcher).recognize!(IN_TRANSIT)).rejects.toMatchObject({ kind });
    });

  it('recognizes a known number and the unknown-number answer, and asks nothing for a number CTTYEX does not issue', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(reply(fixture('in-transit')))
      .mockResolvedValueOnce(reply(fixture('not-found')));
    await expect(carrier(fetcher).recognize!(IN_TRANSIT)).resolves.toEqual({ known: true, lastActivityAt: '2026-03-20T17:10:20.000Z' });
    await expect(carrier(fetcher).recognize!(UNKNOWN)).resolves.toEqual({ known: false });
    await expect(carrier(fetcher).recognize!('CTTY-0')).resolves.toEqual({ known: false });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('rejects numbers CTTYEX does not issue and pre-aborted lookups without a request', async () => {
    const fetcher = vi.fn<typeof fetch>();
    for (const number of ['CTTY001', 'SAMPLETRACKING', `CTTY${'0'.repeat(37)}`]) {
      await expect(carrier(fetcher).track({ number })).rejects.toMatchObject({ kind: 'invalid_input' });
    }
    await expect(carrier(fetcher).track({ number: IN_TRANSIT }, { signal: AbortSignal.abort(new Error('cancelled')) })).rejects.toThrow('cancelled');
    expect(fetcher).not.toHaveBeenCalled();
    expect(normalizeCttyexNumber('ctty 9900 0000 02 cn')).toBe(IN_TRANSIT);
  });

  it('sends a read that hangs once more inside the budget', async () => {
    const signals: AbortSignal[] = [];
    const fetcher = vi.fn<typeof fetch>((_input, init) => new Promise((_resolve, reject) => {
      const signal = init!.signal!;
      signals.push(signal);
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    }));
    const started = Date.now();
    await expect(carrier(fetcher).track({ number: IN_TRANSIT }, { budgetMs: 120 })).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(signals.every((signal) => signal.aborted)).toBe(true);
    expect(Date.now() - started).toBeLessThan(1_000);
  });

  it('routes a number filed under CTTYEX, or detected as one of its numbers, to the adapter', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => reply(fixture('in-transit')));
    const tracker = createTracker({ fetcher, providers: [], env: {} });
    await expect(tracker.track({ number: IN_TRANSIT, carrier: 'cttyex' }, { budgetMs: 3000 }))
      .resolves.toMatchObject({ carrier: 'cttyex', source: 'cttyex', result: { current_stage: 'in_transit' } });
    await expect(tracker.track({ number: IN_TRANSIT }, { budgetMs: 3000 }))
      .resolves.toMatchObject({ carrier: 'cttyex', source: 'cttyex' });
    expect(fetcher.mock.calls.some(([url]) => String(url) === `${CTTYEX_API}?nos=${IN_TRANSIT}`)).toBe(true);
  });
});

describe('CTTYEX numbers', () => {
  it('claims CTTY, ten digits and CN', () => {
    for (const number of [UNKNOWN, IN_TRANSIT, REGISTERED]) {
      expect(detectCarrierMatch(number), number).toMatchObject({ carrier: 'cttyex', confidence: 'high' });
    }
    for (const number of ['CTTY990000001CN', 'CTTY99000000012CN', 'CTTY9900000001US']) {
      expect(detectCarrierMatch(number).carrier, number).not.toBe('cttyex');
    }
  });
});

describe('CTTYEX status vocabulary', () => {
  it('records every wording the map knows with the stage it gives', () => {
    for (const entry of statuses.entries as { wording: string; stage?: string; unmapped?: boolean }[]) {
      if (entry.unmapped) {
        expect(statusMap.stage(null, normalizeStatusWording(entry.wording)), entry.wording).toBeUndefined();
        expect(statusMapAnswer({ carrier: 'cttyex', providerCode: null, description: entry.wording }), entry.wording)
          .toMatchObject({ kind: 'intentional_gap' });
        continue;
      }
      expect(statusMap.stage(null, normalizeStatusWording(entry.wording)), entry.wording).toBe(entry.stage);
      expect(cttyexStage(entry.wording), entry.wording).toEqual({ stage: entry.stage, source: 'carrier_map' });
    }
    expect(statusMapAnswer({ carrier: 'cttyex', providerCode: null, description: 'Arrive at the cross border receiving point' }))
      .toEqual({ kind: 'mapped', stage: 'accepted' });
    expect(statusMapAnswer({ carrier: 'cttyex', providerCode: null, description: 'Synthetic note' })).toEqual({ kind: 'unknown' });
    // A wording the map does not know falls to the shared wording rules.
    expect(cttyexStage('Delivered')).toEqual({ stage: 'delivered', source: 'wording:language' });
    expect(cttyexStage('Synthetic note')).toBeNull();
  });
});
