import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { statusMapAnswer } from '../../core/catalog/statusMaps.js';
import { InvalidInputError, NoHistoryError } from '../../core/errors/index.js';
import { NOOP_RECORDER } from '../../core/telemetry/index.js';
import { adapter, PORTLESS_API, PORTLESS_ORGANIZATION, portlessLookupUrl } from './adapter.js';
import { normalizePortlessNumber, parsePortless } from './parser.js';
import { portlessStage, statusMap } from './status.js';
import statuses from './statuses.json' with { type: 'json' };

const LABELLED = '33ZZQ482917301000931505';
const DELIVERED = 'SYNTHETIC0000PL01';
type Reply = { result: { data: { tracking: Record<string, unknown> & { checkpoints: Record<string, unknown>[] } } } };
const fixture = (name: string): Reply => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')) as Reply;
const tracking = (name: string) => fixture(name).result.data.tracking;
const json = (body: unknown, init: ResponseInit = {}) => new Response(typeof body === 'string' ? body : JSON.stringify(body),
  { ...init, headers: { 'Content-Type': 'application/json', ...init.headers } });
const carrier = (fetcher: typeof fetch) => adapter({ fetcher, recorder: NOOP_RECORDER, env: {}, trawl: null, browserExecutablePath: null });
const replying = (response: () => Response) => vi.fn<typeof fetch>().mockImplementation(async () => response());
const reply = (value: Record<string, unknown>) => ({ result: { data: { tracking: value } } });

describe('Portless numbers', () => {
  it('takes the delivery carrier\'s number: eight to forty letters and digits, with a digit', () => {
    for (const raw of [LABELLED, '33zzq482917301000931505', '33ZZQ 4829 1730 1000 9315 05']) expect(normalizePortlessNumber(raw), raw).toBe(LABELLED);
    for (const raw of ['1234567', 'ABCDEFGHIJ', 'A'.repeat(40) + '1', '33ZZQ48291/7301', '']) {
      expect(() => normalizePortlessNumber(raw), raw).toThrow('eight to forty letters and digits');
    }
  });

  it('refuses another shape before asking', async () => {
    const fetcher = replying(() => json(fixture('info-received.json')));
    await expect(carrier(fetcher).track({ number: 'AB12' })).rejects.toThrow(InvalidInputError);
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('Portless tracking', () => {
  it('asks the tracking page\'s lookup for the number once, in English, under Portless\'s account', async () => {
    const fetcher = replying(() => json(fixture('info-received.json')));
    await carrier(fetcher).track({ number: LABELLED.toLowerCase() });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const url = new URL(String(fetcher.mock.calls[0]![0]));
    expect(`${url.origin}${url.pathname}`).toBe(PORTLESS_API);
    expect(JSON.parse(url.searchParams.get('input')!)).toEqual({ organization_id: PORTLESS_ORGANIZATION, translate_to: 'en', tracking_number: LABELLED });
    expect(url.href).toBe(portlessLookupUrl(LABELLED));
    expect(fetcher.mock.calls[0]![1]).toMatchObject({ method: 'GET' });
  });

  it('reads a label waiting for pickup as registered, with the delivery window and the last-mile carrier', async () => {
    const result = await carrier(replying(() => json(fixture('info-received.json')))).track({ number: LABELLED });
    expect(result).toMatchObject({
      status: 'pending', current_stage: 'registered', current_stage_source: 'carrier_map',
      last_status_text: 'Order Ready, Awaiting Pickup by Our Shipping Partner', last_update: '2026-03-03T10:00:00+10:00',
      expected_delivery: '2026-03-13', expected_delivery_from: '2026-03-09', delivery_carrier: 'australia-post',
    });
    // The last-mile carrier tracks the same number.
    expect(result.delivery_tracking_number).toBeUndefined();
    expect(result.events).toEqual([
      { time: '2026-03-03T10:00:00+10:00', description: 'Order Ready, Awaiting Pickup by Our Shipping Partner',
        provider_code: 'InfoReceived_001', stage: 'registered', stage_source: 'carrier_map' },
      { time: '2026-03-02T13:40:51+10:00', description: 'Shipping Label Created, Carrier Awaiting Item',
        provider_code: 'InfoReceived_001', stage: 'registered', stage_source: 'carrier_map' },
    ]);
  });

  it('reads both legs newest first, with places, and keeps the last mile\'s own number', () => {
    const result = parsePortless(fixture('delivered.json'), DELIVERED);
    expect(result).toMatchObject({
      status: 'delivered', current_stage: 'delivered', last_status_text: 'Delivered', last_update: '2026-03-09T13:02:00+11:00',
      expected_delivery: null, delivery_carrier: 'australia-post', delivery_tracking_number: '33ZZQ482917302000931503',
    });
    expect(result.expected_delivery_from).toBeUndefined();
    const events = result.events ?? [];
    expect(events).toHaveLength(9);
    expect(events[0]).toEqual({ time: '2026-03-09T13:02:00+11:00', description: 'Delivered', location: 'SAMPLEVILLE NSW',
      provider_code: 'Delivered_001', stage: 'delivered', stage_source: 'carrier_map' });
    expect(events.map((event) => event.stage)).toEqual(['delivered', 'out_for_delivery', 'in_transit', 'in_transit', 'customs',
      'in_transit', 'in_transit', 'accepted', 'registered']);
    expect(events.find((event) => event.provider_code === 'InTransit_002')?.location).toBe('Sample City, Sample Province');
    // The recipient's signature is never kept.
    expect(JSON.stringify(result)).not.toContain('Synthetic Recipient');
  });

  it('keeps the reply\'s order for checkpoints of one instant: the later listed is the newer', () => {
    const value = tracking('info-received.json');
    value.checkpoints[1]!.checkpoint_time = value.checkpoints[0]!.checkpoint_time;
    expect(parsePortless(reply(value), LABELLED).last_status_text).toBe('Order Ready, Awaiting Pickup by Our Shipping Partner');
  });

  it('names no last-mile carrier the catalog does not know, or whose rules do not offer the number', () => {
    const unknown = tracking('info-received.json');
    const legs = unknown.multiple_fulfilled_carriers as { last_mile: { carrier: Record<string, unknown>; tracking_url: string; tracking_number: string } };
    legs.last_mile.carrier.name = 'Synthetic Local Courier';
    legs.last_mile.tracking_url = 'https://courier.invalid/track/1';
    expect(parsePortless(reply(unknown), LABELLED).delivery_carrier).toBeUndefined();
    const shape = tracking('info-received.json');
    (shape.multiple_fulfilled_carriers as typeof legs).last_mile.tracking_number = 'SYNTHETIC0000PL02';
    expect(parsePortless(reply(shape), LABELLED)).not.toHaveProperty('delivery_carrier');
  });

  it('reads one estimated day, and no estimate from a window it cannot read', () => {
    const exact = tracking('info-received.json');
    exact.latest_estimated_delivery = { status: 'normal', specific_datetime: '2026-03-11T09:00:00+10:00', min_datetime: null, max_datetime: null };
    expect(parsePortless(reply(exact), LABELLED)).toMatchObject({ expected_delivery: '2026-03-11' });
    expect(parsePortless(reply(exact), LABELLED).expected_delivery_from).toBeUndefined();
    const backwards = tracking('info-received.json');
    backwards.latest_estimated_delivery = { min_datetime: '2026-03-13', max_datetime: '2026-03-09' };
    expect(parsePortless(reply(backwards), LABELLED).expected_delivery).toBeNull();
    const missing = tracking('info-received.json');
    missing.latest_estimated_delivery = null;
    expect(parsePortless(reply(missing), LABELLED).expected_delivery).toBeNull();
  });

  it('reads a checkpoint the map does not know as unknown, not as a stage', () => {
    const value = tracking('info-received.json');
    value.checkpoints = [{ ...value.checkpoints[0]!, sub_status: 'Synthetic_001', status: 'Synthetic', message: 'Synthetic scan' }];
    expect(parsePortless(reply(value), LABELLED)).toMatchObject({ status: 'unknown', last_status_text: 'Synthetic scan' });
    expect(parsePortless(reply(value), LABELLED).current_stage).toBeUndefined();
  });

  it('reads the lookup\'s not-found answer as not found, and no checkpoints as no history', async () => {
    await expect(carrier(replying(() => json(fixture('not-found.json')))).track({ number: LABELLED })).rejects.toMatchObject({ kind: 'not_found' });
    const empty = tracking('info-received.json');
    empty.checkpoints = [];
    await expect(carrier(replying(() => json(reply(empty)))).track({ number: LABELLED })).rejects.toThrow(NoHistoryError);
  });

  it('keeps another number, another error, a changed reply, a bot check, a moved lookup, a rate limit and an outage apart from a missing parcel', async () => {
    const scan = tracking('info-received.json');
    scan.checkpoints[0]!.checkpoint_time = '2026-03-02 13:40:51';
    const cases: [Response, string][] = [
      [json(reply({ ...tracking('info-received.json'), tracking_number: '33ZZQ482917309000931509' })), 'indeterminate'],
      [json({ result: { data: { errorCode: 50000 } } }), 'indeterminate'],
      [json(reply({ ...tracking('info-received.json'), checkpoints: null })), 'schema'],
      [json(reply(scan)), 'schema'],
      [json({ result: {} }), 'schema'],
      [json('<html><body>not json</body></html>'), 'schema'],
      [json('<html><head><title>Just a moment...</title></head></html>'), 'challenge'],
      [json('{"error":{"message":"No procedure found"}}', { status: 404 }), 'transport'],
      [json('', { status: 302, headers: { Location: 'https://ordertrackingupdate.aftership.com/' } }), 'transport'],
      [json('', { status: 429 }), 'rate_limited'],
      [json('{"error":{"message":"Internal Server Error"}}', { status: 500 }), 'indeterminate'],
    ];
    for (const [response, kind] of cases) {
      await expect(carrier(replying(() => response.clone())).track({ number: LABELLED }), kind).rejects.toMatchObject({ kind });
    }
  });
});

describe('Portless status map', () => {
  it('stages every row it lists, and the app reads it', () => {
    for (const { code, wording, stage } of statuses.entries) expect(statusMap.stage(code, wording), wording).toBe(stage);
    expect(statusMapAnswer({ carrier: 'portless', providerCode: 'OutForDelivery_001', description: 'Onboard for delivery' }))
      .toEqual({ kind: 'mapped', stage: 'out_for_delivery' });
    expect(statusMapAnswer({ carrier: 'portless', providerCode: 'Pending_001', description: 'Synthetic pending' }))
      .toMatchObject({ kind: 'intentional_gap' });
  });

  it('lets wording outrank generic transit, a contradicted delivery and customs that are done', () => {
    expect(portlessStage('InTransit_001', 'Out for delivery')?.stage).toBe('out_for_delivery');
    expect(portlessStage('InTransit_001', 'Synthetic scan')).toEqual({ stage: 'in_transit', source: 'carrier_map' });
    expect(portlessStage('Delivered_001', 'Delivery attempted, no one home')?.stage).not.toBe('delivered');
    expect(portlessStage('Delivered_002', 'Synthetic scan')).toEqual({ stage: 'delivered', source: 'carrier_map' });
    expect(portlessStage('OutForDelivery_001', 'Delivered')?.stage).toBe('delivered');
    expect(portlessStage('InTransit_006', 'Customs clearance completed')?.stage).toBe('in_transit');
    expect(portlessStage('InTransit_006', 'Synthetic import processing')).toEqual({ stage: 'customs', source: 'carrier_map' });
    expect(portlessStage('Exception_011', 'Synthetic scan')).toEqual({ stage: 'returned', source: 'carrier_map' });
    expect(portlessStage('OutForDelivery_004', 'Synthetic appointment')).toBeNull();
    expect(portlessStage(null, 'Synthetic scan')).toBeNull();
  });
});
