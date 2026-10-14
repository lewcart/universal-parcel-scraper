import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { deliveryHandoff } from '../../core/catalog/handoff.js';
import { statusMapAnswer } from '../../core/catalog/statusMaps.js';
import { NOOP_RECORDER } from '../../core/telemetry/index.js';
import { createTracker } from '../../facade/index.js';
import { adapter, DHLINK_API, DhlinkTracker } from './adapter.js';
import { DHLINK_LAST_LEGS, normalizeDhlinkNumber, parseDhlink } from './parser.js';
import { dhlinkStage, statusMap } from './status.js';
import statuses from './statuses.json' with { type: 'json' };

const WAREHOUSE = 'XYT9900000001US';
const WAREHOUSE_OWN = 'FC9912310000001';
const POSTAL = 'LV990000006CN';
const LINE = 'FC9912310000003';
const UNKNOWN = 'XYT9900000099US';
const LATER = Date.parse('2026-04-01T00:00:00Z');

type Row = Record<string, unknown>;
type Parcel = Row & { trackinfoList: Row[] };
type Envelope = { code: unknown; msg: unknown; data: { trackList: Parcel[] } };

const fixture = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8')) as Envelope;
const changed = (name: string, change: (parcel: Parcel, envelope: Envelope) => void) => {
  const envelope = fixture(name);
  change(envelope.data.trackList[0]!, envelope);
  return envelope;
};
const reply = (body: unknown, init: ResponseInit = {}) => new Response(typeof body === 'string' ? body : JSON.stringify(body),
  { ...init, headers: { 'Content-Type': typeof body === 'string' ? 'text/html' : 'application/json', ...init.headers } });
const carrier = (fetcher: typeof fetch) => adapter({ fetcher, recorder: NOOP_RECORDER, env: {}, trawl: null, browserExecutablePath: null });
const timeline = (events: readonly Row[] | undefined) => events!.map((event) => [event.local_time, event.provider_code ?? null, event.stage ?? null, event.location ?? null]);
// The firewall's page, with its message written by a script and its ids invented.
const BLOCK_PAGE = '<!doctype html><html><head><meta charset=utf-8><title>403 Forbidden</title></head><body><div class=et id=et></div>'
  + '<span class=emu>https://www.dhlink.com/stage-api/trbiz/track/queryTrack</span><p>00000000_ZZ-000-000000_00000-00000</p>'
  + '<script>e("et").innerText=0==n?"抱歉，您的请求被阻断了":"Sorry, you have been blocked"</script></body></html>';

describe('DHLink HTTP adapter', () => {
  it('asks the tracking page’s lookup for the whole number once, through the supplied transport', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(reply(fixture('swiftx-at-warehouse')));
    const recorder = { ...NOOP_RECORDER, step: vi.fn(), lookup: vi.fn() };
    await expect(new DhlinkTracker({ fetcher, recorder, userAgent: 'SyntheticHost/1.0' }).fetch(' xyt-9900 0000-01us ', { budgetMs: 1000.5 }))
      .resolves.toMatchObject({ current_stage: 'in_transit' });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0]!;
    expect(String(url)).toBe(DHLINK_API);
    expect(init).toMatchObject({ method: 'POST', redirect: 'manual', signal: expect.any(AbortSignal), headers: {
      Accept: 'application/json, text/plain, */*', 'Content-Type': 'application/json;charset=UTF-8', 'User-Agent': 'SyntheticHost/1.0' } });
    expect(JSON.parse(String(init!.body))).toEqual({ trackNos: [WAREHOUSE], state: '', language: 'EN' });
    expect(recorder.step).toHaveBeenCalledWith(expect.objectContaining({ carrier: 'dhlink', step: 'direct', outcome: 'ok' }));
    expect(recorder.lookup).toHaveBeenCalledTimes(1);
  });

  it('reads the warehouse’s nodes and hands the last leg to SwiftX', () => {
    const result = parseDhlink(fixture('swiftx-at-warehouse'), WAREHOUSE, LATER);
    expect(result).toEqual({
      status: 'in_transit', current_stage: 'in_transit', current_stage_source: 'carrier_map',
      last_status_text: 'Package departed from the warehouse', last_update: null, last_update_local: '2026-03-02T15:51:13',
      expected_delivery: null, delivery_carrier: 'swiftx', delivery_tracking_number: 'SWX990000000000000001', destination_country: 'US',
      events: [
        { local_time: '2026-03-02T15:51:13', description: 'Package departed from the warehouse', provider_code: 'WH011', stage: 'in_transit', stage_source: 'carrier_map' },
        { local_time: '2026-03-02T13:51:49', description: 'Package received & scanned at warehouse', provider_code: 'WH001', stage: 'accepted', stage_source: 'carrier_map' },
      ],
    });
    // The DHLink number, the order id and the feeds' and rows' ids are never read.
    expect(JSON.stringify(result)).not.toMatch(/FC9912310000001|99000000001|9900000000001|ZZ0000|P9901/);
    // The parcel's own DHLink number finds it too.
    expect(parseDhlink(fixture('swiftx-at-warehouse'), WAREHOUSE_OWN, LATER).delivery_carrier).toBe('swiftx');
    // The tracker then asks SwiftX's adapter for its own number.
    expect(deliveryHandoff('dhlink', WAREHOUSE, result)).toEqual({ carrier: 'swiftx', number: 'SWX990000000000000001', basis: 'partner' });
  });

  it('keeps one row per scan, preferring DHLink’s node and English, and drops the destination code from Chinese places', () => {
    const result = parseDhlink(fixture('postal-delivered'), POSTAL, LATER);
    expect(result).toMatchObject({ status: 'delivered', current_stage: 'delivered', current_stage_source: 'carrier_map',
      last_status_text: 'Shipment has delivered at 2026-02-20 15:10:00', last_update: null, last_update_local: '2026-02-20T15:10:00' });
    expect(result.destination_country).toBeUndefined();
    expect(result.delivery_carrier).toBeUndefined();
    expect(timeline(result.events)).toEqual([
      ['2026-02-20T15:10:00', 'J014', 'delivered', null],
      ['2026-02-20T07:15:00', 'J013', 'out_for_delivery', null],
      ['2026-02-19T08:00:00', null, 'in_transit', null],
      ['2026-02-12T21:03:00', 'EUBJ010', 'in_transit', null],
      ['2026-02-10T12:15:28', null, 'in_transit', 'Sampleport'],
      ['2026-02-09T02:47:17', null, 'in_transit', 'Sampleport'],
      ['2026-02-09T01:06:58', null, 'customs', 'Sampleport'],
      ['2026-02-08T13:00:03', null, 'accepted', 'Sampletown'],
      ['2026-02-07T14:43:38', null, 'in_transit', '示例省'],
      ['2026-02-07T14:37:38', null, 'accepted', '示例市'],
      ['2026-02-06T23:11:47', 'EUBJ007', 'accepted', '示例市'],
    ]);
    expect(result.events!.map((event) => event.description)).toEqual(expect.arrayContaining(['Handed over to Airlines', 'Item Presented to Customs', '已出库']));
    expect(result.events!.some((event) => /已妥投|安排投递|飞机到达进港|送交出口海关/.test(String(event.description)))).toBe(false);
  });

  it('keeps one row of a scan relayed twice in two formats, without the ZIP codes', () => {
    const result = parseDhlink(fixture('usps-relayed'), LINE, LATER);
    expect(result).toMatchObject({ status: 'delivered', current_stage: 'delivered', destination_country: 'US', last_update_local: '2026-01-24T16:07:00' });
    expect(result.events!.map((event) => [event.local_time, event.description, event.stage, event.location ?? null])).toEqual([
      ['2026-01-24T16:07:00', 'Delivered', 'delivered', 'SAMPLEVILLE, NY'],
      ['2026-01-24T16:02:00', 'SAMPLEVILLE, NY, No Access to Delivery Location', 'failed_attempt', 'SAMPLEVILLE, NY'],
      ['2026-01-24T06:18:00', 'SAMPLEVILLE, NY, US, Out for Delivery, Expected Delivery by 7:40pm', 'out_for_delivery', 'SAMPLEVILLE, NY, US'],
      ['2026-01-20T11:42:00', 'EXAMPLETON, NJ, Arrived Shipping Partner Facility, USPS Awaiting Item', 'in_transit', 'EXAMPLETON, NJ'],
      ['2026-01-19T00:01:04', '货物已交UPS/USPS/Fedex,The goods have been delivered to UPS/USPS/Fedex', 'in_transit', null],
      ['2026-01-16T20:20:00', 'Flight arrival', 'in_transit', null],
      ['2026-01-16T00:48:29', 'Customs clearance completed', 'in_transit', null],
      ['2026-01-13T18:40:00', 'Flight departure', 'in_transit', null],
      // A place of placeholders and a country code alone names no place.
      ['2026-01-09T01:30:42', 'The package has sent from the warehouse', 'in_transit', null],
      ['2026-01-06T20:47:56', 'The collection warehouse has completed sorting', 'accepted', null],
      ['2026-01-03T17:58:49', 'Arrive at the collection warehouse', 'accepted', null],
    ]);
    expect(JSON.stringify(result)).not.toMatch(/9990[12]/);
  });

  it('drops contact details, signatures and British or Canadian postcodes from a relayed row', () => {
    const result = parseDhlink(changed('postal-delivered', (parcel) => {
      Object.assign(parcel.trackinfoList[0]!, { info: '【GB】已妥投，签收人：示例', place: 'SAMPLEBURY ZZ9 9ZZ' });
      Object.assign(parcel.trackinfoList[1]!, { info: 'Delivered, signed for by SAMPLE NAME' });
      Object.assign(parcel.trackinfoList[2]!, { info: 'Scheduled for Delivery SAMPLETOWN Z9Z 9Z9, tel: 99 9999 9999' });
      Object.assign(parcel.trackinfoList[8]!, { info: 'Handed over to Airlines at the airport hotel: gate 9' });
    }), POSTAL, LATER);
    expect(result.events!.slice(0, 2).map((event) => [event.description, event.stage, event.location ?? null])).toEqual([
      ['Delivered', 'delivered', null],
      ['Scheduled for Delivery SAMPLETOWN', 'out_for_delivery', null],
    ]);
    expect(result.events![4]!.description).toBe('Handed over to Airlines at the airport hotel: gate 9');
    expect(JSON.stringify(result)).not.toMatch(/签收人|SAMPLE NAME|ZZ9|Z9Z|9999/);
    // The Chinese row, now without a better English twin, keeps its wording up to the signature.
    const chinese = parseDhlink(changed('postal-delivered', (parcel) => {
      parcel.trackinfoList.splice(1, 1);
      Object.assign(parcel.trackinfoList[0]!, { info: '【GB】已妥投，签收人：示例', place: 'SAMPLEBURY ZZ9 9ZZ' });
    }), POSTAL, LATER);
    expect(chinese.events![0]).toMatchObject({ description: '【GB】已妥投', stage: 'delivered', location: 'SAMPLEBURY' });
  });

  it('holds back rows written ahead of the read, whatever their zone', () => {
    // Read before the flight's arrival at its earliest, UTC+14.
    const result = parseDhlink(fixture('usps-relayed'), LINE, Date.parse('2026-01-16T06:30:00Z'));
    expect(result).toMatchObject({ current_stage: 'in_transit', last_status_text: 'Flight arrival', last_update_local: '2026-01-16T20:20:00' });
    // DHLink's delivered count is not read over rows still to come.
    expect(result.status).toBe('in_transit');
    expect(result.events).toHaveLength(6);
    expect(() => parseDhlink(fixture('usps-relayed'), LINE, Date.parse('2026-01-03T00:00:00Z'))).toThrow(expect.objectContaining({ kind: 'indeterminate' }));
  });

  it('reads DHLink’s delivered count when the last feed’s wording says less', () => {
    const result = parseDhlink(changed('usps-relayed', (parcel) => { parcel.trackinfoList.splice(0, 2); }), LINE, LATER);
    expect(result).toMatchObject({ status: 'delivered', current_stage: 'delivered', current_stage_source: 'carrier_map',
      last_status_text: 'SAMPLEVILLE, NY, No Access to Delivery Location' });
    const moving = parseDhlink(changed('usps-relayed', (parcel) => { parcel.state = 2; parcel.trackinfoList.splice(0, 2); }), LINE, LATER);
    expect(moving).toMatchObject({ status: 'exception', current_stage: 'failed_attempt' });
  });

  it('hands over only through the table, with the whole number in the partner’s layout', () => {
    expect(DHLINK_LAST_LEGS.map((leg) => [leg.carrier, leg.number.source])).toEqual([['swiftx', '^SWX\\d{18}$']]);
    const handoff = (number: unknown) => {
      const result = parseDhlink(changed('swiftx-at-warehouse', (parcel) => { parcel.lastTurnNo = number; }), WAREHOUSE, LATER);
      return [result.delivery_carrier ?? null, result.delivery_tracking_number ?? null];
    };
    expect(handoff('swx 9900 0000 0000 0000 01')).toEqual(['swiftx', 'SWX990000000000000001']);
    for (const number of ['SWX99000000000000001', 'SWX9900000000000000011', 'XSWX990000000000000001', '9400100000000000000001', WAREHOUSE, '', null]) {
      expect(handoff(number), String(number)).toEqual([null, null]);
    }
  });

  it('counts a parcel only when the number asked is its tracking number or DHLink number', () => {
    // The search also finds a parcel by its other numbers.
    expect(() => parseDhlink(fixture('swiftx-at-warehouse'), POSTAL, LATER)).toThrow(expect.objectContaining({ kind: 'indeterminate' }));
    expect(() => parseDhlink(changed('swiftx-at-warehouse', (parcel) => { parcel.trackno = null; parcel.logisticsNo = null; parcel.state = 2; }), WAREHOUSE, LATER))
      .toThrow(expect.objectContaining({ kind: 'indeterminate' }));
  });

  it('rejects a changed reply', () => {
    for (const change of [
      (parcel: Parcel) => { parcel.trackinfoList[0]!.trackTime = '2026-03-02 15:51'; },
      (parcel: Parcel) => { parcel.trackinfoList[0]!.trackTime = '2026-02-30 15:51:13'; },
      (parcel: Parcel) => { parcel.trackinfoList[0]!.trackTime = '2026-03-02 24:00:00'; },
      (parcel: Parcel) => { parcel.trackinfoList[0]!.trackTime = null; },
      (parcel: Parcel) => { parcel.trackinfoList[0]!.info = { en: 'Outbound' }; },
      (parcel: Parcel) => { parcel.trackinfoList[0] = 'Outbound' as never; },
      (parcel: Parcel) => { parcel.trackinfoList = {} as never; },
      (parcel: Parcel) => { parcel.trackinfoList = Array.from({ length: 501 }, () => parcel.trackinfoList[0]!); },
      (parcel: Parcel) => { parcel.trackno = [WAREHOUSE]; },
      (_parcel: Parcel, envelope: Envelope) => { envelope.data.trackList.push(envelope.data.trackList[0]!); },
      (_parcel: Parcel, envelope: Envelope) => { envelope.data = null as never; },
      (_parcel: Parcel, envelope: Envelope) => { envelope.code = '200'; },
    ]) {
      expect(() => parseDhlink(changed('swiftx-at-warehouse', change), WAREHOUSE, LATER)).toThrow(expect.objectContaining({ kind: 'schema' }));
    }
  });

  it('keeps an unknown number, a refused lookup, a parcel without scans and a firewall block apart', async () => {
    const lookup = (body: unknown, number = UNKNOWN, init?: ResponseInit) => carrier(vi.fn<typeof fetch>().mockResolvedValue(reply(body, init))).track({ number });
    await expect(lookup(fixture('not-found'))).rejects.toMatchObject({ kind: 'not_found' });
    await expect(lookup({ ...fixture('not-found'), code: 500, msg: '系统繁忙' })).rejects.toMatchObject({ kind: 'indeterminate' });
    await expect(lookup(changed('swiftx-at-warehouse', (parcel) => { parcel.trackinfoList = null as never; }), WAREHOUSE)).rejects.toMatchObject({ kind: 'indeterminate' });
    await expect(lookup(changed('swiftx-at-warehouse', (parcel) => { parcel.trackinfoList = []; }), WAREHOUSE)).rejects.toMatchObject({ kind: 'indeterminate' });
    // The firewall refuses a headless browser's User-Agent with its page and HTTP 403.
    await expect(lookup(BLOCK_PAGE, UNKNOWN, { status: 403 })).rejects.toMatchObject({ kind: 'challenge' });
    await expect(lookup(BLOCK_PAGE)).rejects.toMatchObject({ kind: 'challenge' });
    await expect(lookup('<html><title>DHLink</title></html>')).rejects.toMatchObject({ kind: 'schema' });
    await expect(lookup('', UNKNOWN, { status: 302, headers: { Location: 'https://www.dhlink.com/' } })).rejects.toMatchObject({ kind: 'transport' });
    // The route answers every number: without it, the service moved.
    await expect(lookup('', UNKNOWN, { status: 404 })).rejects.toMatchObject({ kind: 'transport' });
  });

  it('settles nothing on an empty answer for a DHLink number or a last leg’s number, in retrieval and recognition', async () => {
    // The search answers a parcel's DHLink number this way when the parcel has another
    // tracking number, and the last leg's number always.
    for (const number of ['FC9900000000009', 'SWX990000000000000009']) {
      const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => reply(fixture('not-found')));
      await expect(carrier(fetcher).track({ number }), number).rejects.toMatchObject({ kind: 'indeterminate' });
      await expect(carrier(fetcher).recognize!(number), number).rejects.toMatchObject({ kind: 'indeterminate' });
      expect(fetcher).toHaveBeenCalledTimes(2);
    }
    // Other layouts are looked up by the tracking number they are: the empty answer is not found.
    for (const number of [UNKNOWN, 'LV990000010CN', 'FC99000000000099', 'SWX99000000000000009']) {
      expect(() => parseDhlink(fixture('not-found'), number, LATER), number).toThrow(expect.objectContaining({ kind: 'not_found' }));
    }
  });

  it.each([[403, 'challenge'], [429, 'rate_limited'], [500, 'indeterminate'], [503, 'maintenance']] as const)(
    'preserves HTTP %s as %s during retrieval and recognition', async (status, kind) => {
      const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => new Response('', { status }));
      await expect(carrier(fetcher).track({ number: WAREHOUSE })).rejects.toMatchObject({ kind });
      await expect(carrier(fetcher).recognize!(WAREHOUSE)).rejects.toMatchObject({ kind });
      expect(fetcher).toHaveBeenCalledTimes(2);
    });

  it('recognizes a known parcel and the unknown-number answer, and asks nothing for a number it cannot take', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(reply(fixture('usps-relayed'))).mockResolvedValueOnce(reply(fixture('not-found')));
    await expect(carrier(fetcher).recognize!(LINE)).resolves.toMatchObject({ known: true });
    await expect(carrier(fetcher).recognize!(UNKNOWN)).resolves.toEqual({ known: false });
    await expect(carrier(fetcher).recognize!('NODIGITS')).resolves.toEqual({ known: false });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('rejects numbers it cannot take and pre-aborted lookups without a request', async () => {
    const fetcher = vi.fn<typeof fetch>();
    for (const number of ['NODIGITS', 'FC99123', 'FC9912310000001/1', `FC${'9'.repeat(39)}`, 'FC'.repeat(40)]) {
      await expect(carrier(fetcher).track({ number })).rejects.toMatchObject({ kind: 'invalid_input' });
    }
    await expect(carrier(fetcher).track({ number: WAREHOUSE }, { signal: AbortSignal.abort(new Error('cancelled')) })).rejects.toThrow('cancelled');
    expect(fetcher).not.toHaveBeenCalled();
    expect(normalizeDhlinkNumber('fc 9912.3100-00003')).toBe(LINE);
  });

  it('sends a read that failed to reach the site once more', async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValueOnce(new TypeError('fetch failed')).mockResolvedValueOnce(reply(fixture('usps-relayed')));
    await expect(carrier(fetcher).track({ number: LINE }, { budgetMs: 5000 })).resolves.toMatchObject({ current_stage: 'delivered' });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('ends a hanging read inside the caller’s budget', async () => {
    let signal: AbortSignal | undefined;
    const fetcher = vi.fn<typeof fetch>((_input, init) => new Promise((_resolve, reject) => {
      signal = init?.signal ?? undefined;
      signal?.addEventListener('abort', () => reject(signal?.reason), { once: true });
    }));
    await expect(carrier(fetcher).track({ number: WAREHOUSE }, { budgetMs: 20.5 })).rejects.toThrow();
    expect(signal?.aborted).toBe(true);
  });

  it('routes a parcel filed under DHLink to the adapter', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => reply(fixture('usps-relayed')));
    const answer = await createTracker({ fetcher, providers: [], env: {} }).track({ number: LINE, carrier: 'dhlink' }, { budgetMs: 3000 });
    expect(answer).toMatchObject({ carrier: 'dhlink', source: 'dhlink', result: { current_stage: 'delivered', destination_country: 'US' } });
    expect(fetcher.mock.calls.some(([url]) => String(url) === DHLINK_API)).toBe(true);
  });
});

describe('DHLink status vocabulary', () => {
  it('records every node and wording the map knows with the stage it gives', () => {
    for (const entry of statuses.entries) {
      const code = entry.code ?? '';
      const wording = entry.wording ?? '';
      expect(statusMap.stage(code || null, wording.toLowerCase()), `${code} ${wording}`).toBe(entry.stage);
      expect(dhlinkStage(code, '', wording)?.stage, `${code} ${wording}`).toBe(entry.stage);
    }
    // A line whose codes the map does not know is read by its node's name.
    expect(dhlinkStage('ZZ001', 'Pending delivery', 'Synthetic note')).toEqual({ stage: 'out_for_delivery', source: 'carrier_map' });
    // The partners' relayed English goes through the shared rules.
    expect(dhlinkStage('', '', 'Out for Delivery SAMPLETOWN NY')).toEqual({ stage: 'out_for_delivery', source: 'wording:language' });
    expect(dhlinkStage('', '', 'Synthetic note')).toBeNull();
    // The hand-over to the US partner is no delivery.
    expect(statusMapAnswer({ carrier: 'dhlink', providerCode: null, description: '货物已交UPS/USPS/Fedex,The goods have been delivered to UPS/USPS/Fedex' }))
      .toEqual({ kind: 'mapped', stage: 'in_transit' });
    expect(statusMapAnswer({ carrier: 'dhlink', providerCode: 'SYNTHETIC', description: 'Synthetic note' })).toEqual({ kind: 'unknown' });
    expect(statusMapAnswer({ carrier: 'dhlink', providerCode: 'J014', description: 'Shipment has delivered at …' })).toEqual({ kind: 'mapped', stage: 'delivered' });
  });
});
