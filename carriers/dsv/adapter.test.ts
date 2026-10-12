import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { recognitionAskedCarriers } from '../../core/catalog/recognition.js';
import { statusMapAnswer } from '../../core/catalog/statusMaps.js';
import { detectCarrierMatch, parseTrackingInput } from '../../core/detection/index.js';
import { NOOP_RECORDER } from '../../core/telemetry/index.js';
import { createTracker } from '../../facade/index.js';
import { adapter, DSV_SEARCH_ENDPOINT, DSV_SHIPMENT_ENDPOINT, DSV_STATUSES_ENDPOINT, DsvTracker } from './adapter.js';
import { confirmDsvShipment, parseDsvStatuses, pickDsvShipment, type DsvShipment } from './parser.js';
import { dsvCodeStage, statusMap } from './status.js';
import statuses from './statuses.json' with { type: 'json' };

const HOUSE_BILL = 'ZZX0000017';
const BOOKING = '990000001';
const UNKNOWN = 'ZZ99999999';
const AIR_KEY = '00000000-0000-4000-8000-00000000a001';
const ROAD_KEY = '00000000-0000-4000-8000-00000000b002';
const AIR: DsvShipment = { key: AIR_KEY, mode: 'AIR', own: false };
const ROAD: DsvShipment = { key: ROAD_KEY, mode: 'ROAD', own: true };
const text = (name: string) => readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8');
const json = (name: string) => JSON.parse(text(name)) as Record<string, unknown>;
const reply = (body: string, status = 200) => new Response(body, { status, headers: { 'Content-Type': 'application/json' } });
const carrier = (fetcher: typeof fetch) => adapter({ fetcher, recorder: NOOP_RECORDER, env: {}, trawl: null, browserExecutablePath: null });
/** Answers each myDSV route from the named fixtures. */
const routes = (search: string, details: string | null, history: string) => vi.fn<typeof fetch>().mockImplementation(async (input) => {
  const url = String(input);
  if (url.startsWith(DSV_SEARCH_ENDPOINT)) return reply(text(search));
  if (url.startsWith(DSV_STATUSES_ENDPOINT)) return reply(text(history));
  if (details && url.startsWith(DSV_SHIPMENT_ENDPOINT)) return reply(text(details));
  return reply('{}', 404);
});
const rows = (result: ReturnType<typeof parseDsvStatuses>) =>
  result.events!.map(event => [event.local_time, event.provider_code, event.stage ?? null, event.location ?? null]);
type Row = Record<string, unknown> & { children?: Row[] };
type Group = Row & { children: Row[] };
const editedHistory = (name: string, change: (payload: { events: Group[]; legData: null | Record<string, unknown> }) => void) => {
  const payload = JSON.parse(text(name)) as { events: Group[]; legData: null | Record<string, unknown> };
  change(payload);
  return payload;
};

describe('DSV tracking adapter', () => {
  it('searches myDSV for the whole number, confirms a house bill in the details and reads the history by the shipment key', async () => {
    const fetcher = routes('search-air', 'details-air', 'statuses-air');
    const recorder = { ...NOOP_RECORDER, step: vi.fn(), lookup: vi.fn() };
    await expect(new DsvTracker({ fetcher, recorder, userAgent: 'SyntheticHost/1.0' }).fetch(' zzx 000-0017 ', { budgetMs: 1000.5 }))
      .resolves.toMatchObject({ status: 'delivered' });
    expect(fetcher.mock.calls.map(([url]) => String(url))).toEqual([
      `https://mydsv.com/app/search/publicShipmentList?q=${HOUSE_BILL}`,
      `https://mydsv.com/app/search/shipment/${AIR_KEY}?detailedMilestones=true`,
      `https://mydsv.com/app/search/shipment/new-statuses/${AIR_KEY}`,
    ]);
    for (const [, init] of fetcher.mock.calls) {
      expect(init).toMatchObject({ signal: expect.any(AbortSignal), headers: { Accept: 'application/json', 'User-Agent': 'SyntheticHost/1.0' } });
      expect(init?.method ?? 'GET').toBe('GET');
      expect(new Headers(init!.headers).has('cookie')).toBe(false);
    }
    expect(recorder.step).toHaveBeenCalledWith(expect.objectContaining({ carrier: 'dsv', step: 'direct', outcome: 'ok' }));
    expect(recorder.lookup).toHaveBeenCalledTimes(1);
  });

  it('skips the details when the search names the number as the shipment’s own id', async () => {
    const fetcher = routes('search-road', null, 'statuses-road');
    await expect(carrier(fetcher).track({ number: BOOKING })).resolves.toMatchObject({ current_stage: 'accepted' });
    expect(fetcher.mock.calls.map(([url]) => String(url))).toEqual([
      `${DSV_SEARCH_ENDPOINT}?q=${BOOKING}`, `${DSV_STATUSES_ENDPOINT}${ROAD_KEY}`,
    ]);
    await expect(carrier(routes('search-road', null, 'statuses-road')).track({ number: 'ZZR0000000042' }))
      .resolves.toMatchObject({ current_stage: 'accepted' });
  });

  it('reads an air shipment as the page lists it: the groups around the main carriage and each port’s own rows, as wall clocks', () => {
    const result = parseDsvStatuses(json('statuses-air'), AIR);
    expect(result).toMatchObject({ status: 'delivered', current_stage: 'delivered', current_stage_source: 'carrier_map',
      last_status_text: 'Handover responsibilty of cargo', last_update: null, last_update_local: '2026-03-07T10:45:00',
      expected_delivery: null });
    expect(rows(result)).toEqual([
      ['2026-03-07T10:45:00', 'Z70', 'delivered', null],
      ['2026-03-06T18:10:00', 'ARV', 'in_transit', 'Receivertown Apt, XC'],
      ['2026-03-05T21:15:00', 'DEP', 'in_transit', 'Transit Hub, XB'],
      ['2026-03-05T06:40:00', 'ARV', 'in_transit', 'Transit Hub, XB'],
      ['2026-03-04T11:20:00', 'DEP', 'in_transit', 'Example Airport, XA'],
      ['2026-03-03T15:05:00', 'IRP', 'accepted', 'XA'],
      // A booking comes with its day alone.
      ['2026-03-02', 'BOOKING', 'registered', null],
    ]);
    expect(result.events!.every(event => event.time === undefined && event.description)).toBe(true);
    // Earlier values of a row are its history, not rows of their own.
    expect(result.events!.some(event => event.local_time === '2026-03-05T22:05:00')).toBe(false);
  });

  it('reads the history groups without port data, drops postcodes and keeps the delivery estimate until delivery', () => {
    const result = parseDsvStatuses(json('statuses-road'), ROAD);
    expect(result).toMatchObject({ status: 'in_transit', current_stage: 'accepted', last_status_text: 'Actual pickup',
      last_update_local: '2026-05-12T16:40:00', expected_delivery: '2026-05-15', expected_delivery_from: '2026-05-14' });
    expect(rows(result)).toEqual([
      ['2026-05-12T16:40:00', 'ACTUAL_PICKUP', 'accepted', 'SENDERTOWN, XA'],
      ['2026-05-11T14:25:00', 'CREATION', 'registered', null],
    ]);
    const delivered = editedHistory('statuses-road', payload => {
      payload.events[0]!.children.unshift({ ...payload.events[0]!.children[0]!, eventCode: 'ACTUAL_DELIVERY', description: 'Actual delivery',
        eventDate: '2026-05-13T10:05:00', eventDateTo: null });
    });
    expect(parseDsvStatuses(delivered, ROAD)).toMatchObject({ status: 'delivered', current_stage: 'delivered', expected_delivery: null });
    expect(parseDsvStatuses(delivered, ROAD).expected_delivery_from).toBeUndefined();
    // One day of estimate has no window.
    const day = editedHistory('statuses-road', payload => { payload.events[0]!.children[0]!.eventDateTo = null; });
    expect(parseDsvStatuses(day, ROAD)).toMatchObject({ expected_delivery: '2026-05-14' });
    expect(parseDsvStatuses(day, ROAD).expected_delivery_from).toBeUndefined();
  });

  it('never reads the parties, references, contacts or the shipment key', async () => {
    const result = await carrier(routes('search-road', null, 'statuses-road')).track({ number: BOOKING });
    const air = await carrier(routes('search-air', 'details-air', 'statuses-air')).track({ number: HOUSE_BILL });
    for (const answer of [result, air]) {
      expect(JSON.stringify(answer)).not.toMatch(/Example (?:Sender|Receiver|Signer)|Sample (?:Street|Road)|RECEIVERTOWN|00000(?!-)|11111|99999-000|PO-EXAMPLE|example@|\+00|00000000-0000|123\.4/);
    }
  });

  it('flattens an XPRESS shipment’s earlier rows as its page does, and counts a repeated row once', () => {
    const xpress = editedHistory('statuses-air', payload => { payload.legData = null; });
    expect(parseDsvStatuses(xpress, { ...AIR, mode: 'XPRESS' }).events!.map(event => event.local_time))
      .toContain('2026-03-05T21:15:00');
    expect(parseDsvStatuses(xpress, AIR).events!.map(event => event.local_time)).not.toContain('2026-03-05T21:15:00');
    const repeated = editedHistory('statuses-road', payload => {
      payload.events[1]!.children.push({ ...payload.events[1]!.children[0]! });
      payload.events.reverse();
    });
    expect(rows(parseDsvStatuses(repeated, ROAD))).toEqual(rows(parseDsvStatuses(json('statuses-road'), ROAD)));
  });

  it('leaves cancelled rows and estimates out, and stages new codes through the shared wording rules', () => {
    const cancelled = editedHistory('statuses-road', payload => { payload.events[1]!.children[0]!.cancelled = true; });
    expect(parseDsvStatuses(cancelled, ROAD)).toMatchObject({ current_stage: 'registered', last_status_text: 'Creation' });
    const worded = editedHistory('statuses-road', payload => {
      payload.events[1]!.children.unshift({ ...payload.events[1]!.children[0]!, eventCode: 'POD_RECEIVED', description: 'Shipment delivered',
        eventDate: '2026-05-13T09:00:00' },
      { ...payload.events[1]!.children[0]!, eventCode: 'PLANNED_X', description: 'Planned delivery', eventDate: '2026-05-20T09:00:00' });
    });
    expect(parseDsvStatuses(worded, ROAD)).toMatchObject({ current_stage: 'delivered', current_stage_source: expect.stringMatching(/^wording:/) });
    const unknown = editedHistory('statuses-road', payload => {
      payload.events[1]!.children.unshift({ ...payload.events[1]!.children[0]!, eventCode: 'ZZZ', description: 'Documents checked',
        eventDate: '2026-05-13T09:00:00', location: { place: '-', countryCode: 'XA' } });
    });
    const result = parseDsvStatuses(unknown, ROAD);
    expect(result).toMatchObject({ status: 'unknown', last_status_text: 'Documents checked' });
    expect(result.current_stage).toBeUndefined();
    expect(result.events![0]).toEqual({ local_time: '2026-05-13T09:00:00', description: 'Documents checked', provider_code: 'ZZZ', location: 'XA' });
    const estimates = editedHistory('statuses-road', payload => { payload.events.splice(1); });
    expect(() => parseDsvStatuses(estimates, ROAD)).toThrow(expect.objectContaining({ kind: 'indeterminate', reason: 'no_history' }));
  });

  it('leaves a number the search does not know, or knows only by references, open', async () => {
    expect(() => pickDsvShipment(json('search-empty'), UNKNOWN)).toThrow(expect.objectContaining({ kind: 'indeterminate', reason: 'portal_not_found' }));
    const fetcher = routes('search-empty', null, 'statuses-road');
    await expect(carrier(fetcher).track({ number: UNKNOWN })).rejects.toMatchObject({ kind: 'indeterminate', reason: 'portal_not_found' });
    expect(fetcher).toHaveBeenCalledTimes(1);
    // A match on another id or the master bill only, such as a customer's or an airline's number.
    const master = { ...json('details-air'), houseBillNumber: 'ZZX0000099' };
    expect(() => confirmDsvShipment(master, '99900000011')).toThrow(expect.objectContaining({ kind: 'indeterminate', reason: 'reference_only' }));
    expect(() => confirmDsvShipment(json('details-air'), HOUSE_BILL)).not.toThrow();
    expect(() => confirmDsvShipment(json('details-air'), 'SZZX0000017')).not.toThrow();
    const reference = vi.fn<typeof fetch>().mockImplementation(async (input) => String(input).startsWith(DSV_SEARCH_ENDPOINT)
      ? reply(text('search-air')) : reply(JSON.stringify(master)));
    await expect(carrier(reference).track({ number: 'ZZX0000099A' })).rejects.toMatchObject({ kind: 'indeterminate', reason: 'reference_only' });
    expect(reference).toHaveBeenCalledTimes(2);
    const air = json('search-air').data as Record<string, unknown>[];
    const road = json('search-road').data as Record<string, unknown>[];
    expect(() => pickDsvShipment({ data: [...air, ...road] }, 'POEXAMPLE1')).toThrow(expect.objectContaining({ reason: 'reference_only' }));
    expect(() => pickDsvShipment({ data: [...road, { ...road[0], randomIdentifier: AIR_KEY }] }, BOOKING))
      .toThrow(expect.objectContaining({ kind: 'indeterminate', reason: 'several_parcels' }));
    expect(pickDsvShipment({ data: [...air, ...road] }, BOOKING)).toEqual(ROAD);
  });

  it('takes letters and digits myDSV searches, without a request for anything else', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => reply(text('search-empty')));
    for (const number of ['ABCDEFGH', '1234', 'Z'.repeat(40) + '1', 'ZZ0000/01', 'ZZ_000001']) {
      await expect(carrier(fetcher).track({ number }), number).rejects.toMatchObject({ kind: 'invalid_input' });
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects malformed replies', () => {
    for (const payload of [null, [], {}, { data: {} }, { data: [1] }, { data: Array.from({ length: 101 }, () => ({})) },
      { data: [{ ...(json('search-road').data as object[])[0], randomIdentifier: '../x' }] }]) {
      expect(() => pickDsvShipment(payload, BOOKING), JSON.stringify(payload).slice(0, 80)).toThrow(expect.objectContaining({ kind: 'schema' }));
    }
    expect(() => confirmDsvShipment([], HOUSE_BILL)).toThrow(expect.objectContaining({ kind: 'schema' }));
    for (const payload of [null, [], {}, { events: {} }, { events: [], legData: [] },
      editedHistory('statuses-road', reply => { reply.events[1]!.children[0]!.eventDate = '12/05/2026 16:40'; }),
      editedHistory('statuses-road', reply => { reply.events[1]!.children[0]!.eventDate = '2026-02-30T16:40:00'; }),
      editedHistory('statuses-road', reply => { reply.events[1]!.children[0]!.eventCode = 'A B'; }),
      editedHistory('statuses-road', reply => { reply.events[1]!.children = 'none' as unknown as Row[]; }),
      editedHistory('statuses-road', reply => { (reply.events as unknown[])[1] = 'group'; }),
      editedHistory('statuses-air', reply => { (reply.legData!.legs as Record<string, unknown>[])[0]!.legEvents = [7]; })]) {
      expect(() => parseDsvStatuses(payload, ROAD), JSON.stringify(payload).slice(0, 80)).toThrow(expect.objectContaining({ kind: 'schema' }));
    }
  });

  it.each([[403, 'challenge'], [429, 'rate_limited'], [404, 'transport'], [410, 'transport'], [500, 'indeterminate'], [503, 'maintenance']] as const)(
    'keeps HTTP %s as %s on every request, without a retry and without the shipment key on the error', async (status, kind) => {
      const search = vi.fn<typeof fetch>().mockImplementation(async () => reply('{"error":"failure"}', status));
      await expect(carrier(search).track({ number: BOOKING })).rejects.toMatchObject({ kind });
      expect(search).toHaveBeenCalledTimes(1);
      const history = vi.fn<typeof fetch>().mockImplementation(async (input) => String(input).startsWith(DSV_SEARCH_ENDPOINT)
        ? reply(text('search-road')) : reply(`{"error":"failure ${ROAD_KEY}"}`, status));
      const error = await carrier(history).track({ number: BOOKING }).catch((caught: unknown) => caught);
      expect(error).toMatchObject({ kind });
      expect(history).toHaveBeenCalledTimes(2);
      expect(JSON.stringify(error)).not.toContain(ROAD_KEY);
      expect((error as { request?: unknown }).request).toBeUndefined();
      expect((error as { diagnostics?: unknown }).diagnostics).toBeUndefined();
      expect((error as { cause?: unknown }).cause).toBeUndefined();
    });

  it('keeps block pages and malformed replies apart from missing shipments', async () => {
    for (const [body, kind] of [
      ['<html><head><title>Access Denied</title></head><body>You don\'t have permission to access this server.</body></html>', 'challenge'],
      ['<html><head><title>Just a moment...</title></head><body></body></html>', 'challenge'],
      ['<!doctype html><html><head><title>myDSV</title></head><body><app-root></app-root></body></html>', 'schema'], ['', 'schema']] as const) {
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(reply(body));
      await expect(carrier(fetcher).track({ number: BOOKING }), body).rejects.toMatchObject({ kind });
      const later = vi.fn<typeof fetch>().mockImplementation(async (input) => String(input).startsWith(DSV_SEARCH_ENDPOINT)
        ? reply(text('search-road')) : reply(body));
      await expect(carrier(later).track({ number: BOOKING }), body).rejects.toMatchObject({ kind });
    }
    const large = vi.fn<typeof fetch>().mockResolvedValue(new Response(new Uint8Array(1_100_000)));
    await expect(carrier(large).track({ number: BOOKING })).rejects.toThrow('unexpectedly large');
  });

  it('tries the lookup once more after a failed connection, inside the caller’s budget', async () => {
    const answers = routes('search-road', null, 'statuses-road');
    const flaky = vi.fn<typeof fetch>().mockImplementationOnce(async (input) => answers(input))
      .mockRejectedValueOnce(new TypeError('fetch failed')).mockImplementation(async (input) => answers(input));
    await expect(carrier(flaky).track({ number: BOOKING })).resolves.toMatchObject({ current_stage: 'accepted' });
    expect(flaky).toHaveBeenCalledTimes(4);
    const failed = await carrier(vi.fn<typeof fetch>().mockImplementation(async (input) => String(input).startsWith(DSV_SEARCH_ENDPOINT)
      ? reply(text('search-road')) : Promise.reject(new TypeError('fetch failed')))).track({ number: BOOKING }).catch((caught: unknown) => caught);
    expect(failed).toMatchObject({ kind: 'transport' });
    expect(JSON.stringify(failed)).not.toContain(ROAD_KEY);
    const immediate = routes('search-road', null, 'statuses-road');
    await expect(carrier(immediate).track({ number: BOOKING }, { signal: AbortSignal.abort(new Error('cancelled')) })).rejects.toThrow('cancelled');
    await expect(carrier(immediate).track({ number: BOOKING }, { budgetMs: 0 })).rejects.toMatchObject({ kind: 'budget' });
    expect(immediate).not.toHaveBeenCalled();
    const slow = vi.fn<typeof fetch>((_input, init) => new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal!.reason), { once: true });
    }));
    await expect(carrier(slow).track({ number: BOOKING }, { budgetMs: 20.5 }))
      .rejects.toMatchObject({ kind: expect.stringMatching(/^(?:transport|budget)$/) });
    expect(slow.mock.calls.length).toBeLessThanOrEqual(2);
    expect(slow.mock.calls.every(([, init]) => init?.signal?.aborted)).toBe(true);
  });

  it('routes a shipment filed under DSV to the adapter, which detection never offers and recognition never asks', async () => {
    const fetcher = routes('search-road', null, 'statuses-road');
    const answer = await createTracker({ fetcher, providers: [], env: {} }).track({ number: BOOKING, carrier: 'dsv' }, { budgetMs: 3000 });
    expect(answer).toMatchObject({ carrier: 'dsv', source: 'dsv', result: { current_stage: 'accepted' } });
    expect(fetcher.mock.calls.every(([url]) => String(url).startsWith('https://mydsv.com/app/search/'))).toBe(true);
    expect(carrier(fetcher).recognize).toBeUndefined();
    for (const number of [HOUSE_BILL, BOOKING, 'ZZR0000000042']) {
      expect(detectCarrierMatch(number)?.carrier).not.toBe('dsv');
      expect(recognitionAskedCarriers(number)).not.toContain('dsv');
    }
    expect(parseTrackingInput(`https://mydsv.com/new/tracking/track-shipment?query=${HOUSE_BILL}`))
      .toMatchObject({ trackingNumber: HOUSE_BILL, carrier: 'dsv', source: 'link' });
  });
});

describe('DSV status vocabulary', () => {
  it('records every code the map knows with the stage it gives, and the estimates it leaves out on purpose', () => {
    for (const entry of statuses.entries) {
      const stage = 'stage' in entry ? entry.stage : undefined;
      expect(dsvCodeStage(entry.code), entry.code).toBe(stage);
      expect(statusMap.stage(entry.code, entry.wording.toLowerCase())).toBe(stage);
      if (!stage) {
        expect(statusMapAnswer({ carrier: 'dsv', providerCode: entry.code, description: entry.wording }), entry.code)
          .toMatchObject({ kind: 'intentional_gap' });
      }
    }
    for (const code of ['constructor', 'toString', 'XYZ', '']) expect(dsvCodeStage(code), code).toBeUndefined();
    expect(statusMapAnswer({ carrier: 'dsv', providerCode: 'Z70', description: 'Handover responsibilty of cargo' }))
      .toEqual({ kind: 'mapped', stage: 'delivered' });
  });
});
