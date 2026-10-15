import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { statusMapAnswer } from '../../core/catalog/statusMaps.js';
import { detectCarrierMatch } from '../../core/detection/index.js';
import { NOOP_RECORDER } from '../../core/telemetry/index.js';
import { createTracker } from '../../facade/index.js';
import { universalCarrierHints } from '../../providers/shared/hints.js';
import { adapter, MAILAMERICAS_API, MailamericasTracker } from './adapter.js';
import { mailamericasWording, normalizeMailamericasNumber, parseMailamericas } from './parser.js';
import { mailamericasStage, statusMap } from './status.js';
import statuses from './statuses.json' with { type: 'json' };

const DELIVERED = 'MLAR000000002EX';
const IN_TRANSIT = 'MLCO000000001R';
const UNKNOWN = 'MLPE000000000R';

type Row = Record<string, unknown>;
type Shipment = Row & { events: Row[] };
type Reply = Row & { data: Shipment };

const fixture = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8')) as Reply;
const changed = (name: string, change: (data: Shipment, reply: Reply) => void) => {
  const reply = fixture(name);
  change(reply.data, reply);
  return reply;
};
const reply = (body: unknown, init: ResponseInit = {}) => new Response(typeof body === 'string' ? body : JSON.stringify(body),
  { ...init, headers: { 'Content-Type': 'application/json', ...init.headers } });
const carrier = (fetcher: typeof fetch) => adapter({ fetcher, recorder: NOOP_RECORDER, env: {}, trawl: null, browserExecutablePath: null });
// The page AWS's load balancer serves when it turns a client away.
const BALANCER = '<html>\r\n<head><title>403 Forbidden</title></head>\r\n<body>\r\n<center><h1>403 Forbidden</h1></center>\r\n</body>\r\n</html>\r\n';

describe('MailAmericas HTTP adapter', () => {
  it('posts the whole number in capitals to the tracking page’s lookup once, through the supplied transport', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(reply(fixture('in-transit')));
    const recorder = { ...NOOP_RECORDER, step: vi.fn(), lookup: vi.fn() };
    await expect(new MailamericasTracker({ fetcher, recorder, userAgent: 'SyntheticHost/1.0' }).fetch(' mlco 0000-00001r ', { budgetMs: 1000.5 }))
      .resolves.toMatchObject({ current_stage: 'customs' });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0]!;
    expect(String(url)).toBe(MAILAMERICAS_API);
    expect(init).toMatchObject({ method: 'POST', redirect: 'manual', signal: expect.any(AbortSignal),
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'SyntheticHost/1.0' } });
    expect(JSON.parse(String(init!.body))).toEqual({ trackingNumber: IN_TRANSIT, language: 'en' });
    expect(recorder.step).toHaveBeenCalledWith(expect.objectContaining({ carrier: 'mailamericas', step: 'direct', outcome: 'ok' }));
    expect(recorder.lookup).toHaveBeenCalledTimes(1);
  });

  it('keeps each scan’s wall clock and stages it by its code', () => {
    const result = parseMailamericas(fixture('in-transit'), IN_TRANSIT);
    expect(result).toMatchObject({ status: 'in_transit', current_stage: 'customs', current_stage_source: 'carrier_map',
      last_status_text: 'Destination customs: Received by Destination Customs', last_update: null,
      last_update_local: '2026-05-21T09:15:00', expected_delivery: '2026-06-02', service_name: 'Priority', destination_country: 'CO' });
    expect(result.events!.map((event) => [event.local_time, event.provider_code, event.stage ?? null, event.location ?? null])).toEqual([
      ['2026-05-21T09:15:00', 'AD-1', 'customs', null],
      ['2026-05-20T23:05:00', 'AR-1', 'in_transit', null],
      ['2026-05-19T03:20:00', 'TD-4', 'in_transit', 'SMP'],
      ['2026-05-18T17:45:00', 'TD-1', 'in_transit', 'Sample City'],
      ['2026-05-18T08:30:00', 'HB-4', 'in_transit', null],
      // The repeated warehouse scan is kept once.
      ['2026-05-17T21:10:00', 'WH-3', 'in_transit', 'Sample City'],
      // A duty recorded as paid at the origin warehouse moves nothing.
      ['2026-05-17T06:02:00', 'AD-4', null, null],
      ['2026-05-16T19:44:00', 'WH-2', 'in_transit', 'Sample City'],
      ['2026-05-16T11:30:00', 'WH-1', 'accepted', 'Sample City'],
      ['2026-05-15T14:12:00', 'SM-4', null, null],
      ['2026-05-15T14:12:00', 'OC-1', 'registered', null],
    ]);
    expect(result.events!.every((event) => event.time === undefined)).toBe(true);
    expect(result.events!.at(-1)).toMatchObject({ description: 'Order created: Label generated', stage_source: 'carrier_map' });
  });

  it('keeps the delivery without the buyer, the tax ID, the proof of delivery or the repeated scan', () => {
    const result = parseMailamericas(fixture('delivered'), DELIVERED);
    expect(result).toMatchObject({ status: 'delivered', current_stage: 'delivered', current_stage_source: 'carrier_map',
      last_status_text: 'Finished: Delivered', last_update: null, last_update_local: '2026-03-24T16:47:00', expected_delivery: null,
      service_name: 'Registered', destination_country: 'AR' });
    expect(result.events).toHaveLength(28);
    expect(result.events!.slice(0, 4).map((event) => [event.provider_code, event.stage, event.description])).toEqual([
      ['PF-1', 'delivered', 'Finished: Delivered'],
      ['LM-2', 'out_for_delivery', 'Delivery office: In distribution with postman'],
      ['LM-7', 'failed_attempt', 'Delivery office: Recipient Absent'],
      ['LM-2', 'out_for_delivery', 'Delivery office: In distribution with postman'],
    ]);
    expect(result.events!.filter((event) => event.stage === undefined).map((event) => event.provider_code)).toEqual(['AV-1', 'SM-4', 'SM-1', 'SM-2']);
    expect(JSON.stringify(result)).not.toMatch(/Sample (?:Buyer|Courier|Marketplace|Province)|0000000000|PR0001|SMPL02AR|Argentina|China|lastMile/);
  });

  it('takes the summary’s word for a return, a claim or a parcel held back', () => {
    const returned = parseMailamericas(changed('delivered', (data) => {
      data.status = 'returned';
      Object.assign(data.events[0]!, { code: 'PF-2', eventStep: 8, description: 'Delivered to return address' });
    }), DELIVERED);
    expect(returned).toMatchObject({ status: 'exception', current_stage: 'returned', current_stage_source: 'carrier_map',
      last_status_text: 'Finished: Delivered to return address', expected_delivery: null });
    const claim = parseMailamericas(changed('in-transit', (data) => { data.status = 'claim'; }), IN_TRANSIT);
    expect(claim).toMatchObject({ status: 'exception', current_stage: 'exception', current_stage_source: 'carrier_map' });
    const held = parseMailamericas(changed('in-transit', (data) => { data.isRetainedAtOrigin = true; }), IN_TRANSIT);
    expect(held).toMatchObject({ current_stage: 'exception', expected_delivery: '2026-06-02' });
    // The summary's own word that agrees with the newest scan keeps the scan's source.
    expect(parseMailamericas(changed('in-transit', (data) => { data.status = 'IN-TRANSIT'; }), IN_TRANSIT))
      .toMatchObject({ current_stage: 'customs' });
  });

  it('drops the reply’s placeholders for a missing estimate, service or destination', () => {
    const result = parseMailamericas(changed('in-transit', (data) => {
      data.estimatedDelivery = '1970-01-01';
      data.service = 'N/A';
      data.destination = 'No data';
    }), IN_TRANSIT);
    expect(result.expected_delivery).toBeNull();
    expect(result).not.toHaveProperty('service_name');
    expect(result).not.toHaveProperty('destination_country');
    expect(result).not.toHaveProperty('destination_country_name');
    const named = parseMailamericas(changed('in-transit', (data) => { data.destination = 'Sampleland'; }), IN_TRANSIT);
    expect(named).toMatchObject({ destination_country_name: 'Sampleland' });
  });

  it('reads a history listed oldest first newest first, as the page shows it', () => {
    const result = parseMailamericas(changed('in-transit', (data) => { data.events.reverse(); }), IN_TRANSIT);
    expect(result).toMatchObject({ last_update_local: '2026-05-21T09:15:00', current_stage: 'customs' });
    expect(result.events!.at(-1)).toMatchObject({ provider_code: 'OC-1' });
  });

  it('takes people and phone numbers out of the wording', () => {
    expect(mailamericasWording('Finished', 'Delivered by Sample Person', 'PF-1')).toBe('Finished: Delivered');
    expect(mailamericasWording('Delivery office', 'Recibido por Sample Person, DNI 00000000', 'LM-1')).toBe('Delivery office: Recibido');
    expect(mailamericasWording('Finished', 'Entregue pelo carteiro a Sample Person', 'pf-1')).toBe('Finished: Entregue');
    // Other legs name organisations, not people.
    expect(mailamericasWording('Received in destination office', 'Received by Last Mile Provider', 'RC-1'))
      .toBe('Received in destination office: Received by Last Mile Provider');
    expect(mailamericasWording('Notification', 'Call +00 (0) 000 000 0000 or 000-000-0000.', 'AV-1')).toBe('Notification: Call or.');
    // A date stays, and a line that repeats its leg is not doubled.
    expect(mailamericasWording('Notification', 'New delivery date 2026-05-20', 'AV-1')).toBe('Notification: New delivery date 2026-05-20');
    expect(mailamericasWording('Delivered', 'Delivered', 'PF-1')).toBe('Delivered');
    expect(mailamericasWording('Order created', '', 'OC-1')).toBe('Order created');
    expect(mailamericasWording('', 'Label generated', 'OC-1')).toBe('Label generated');
  });

  it('reads an unknown number as not found, a failed lookup as inconclusive and a record without scans as no history', () => {
    expect(() => parseMailamericas(fixture('not-found'), UNKNOWN)).toThrow(expect.objectContaining({ kind: 'not_found' }));
    expect(() => parseMailamericas({ error: 'Error al consultar el tracking' }, UNKNOWN)).toThrow(expect.objectContaining({ kind: 'schema' }));
    expect(() => parseMailamericas({ data: null, error: 'Error al consultar el tracking' }, UNKNOWN))
      .toThrow(expect.objectContaining({ kind: 'indeterminate' }));
    expect(() => parseMailamericas(changed('delivered', (data) => { data.events = []; }), DELIVERED))
      .toThrow(expect.objectContaining({ kind: 'indeterminate', name: 'NoHistoryError' }));
    expect(() => parseMailamericas(changed('delivered', (data) => { delete (data as Row).events; }), DELIVERED))
      .toThrow(expect.objectContaining({ name: 'NoHistoryError' }));
  });

  it('counts a shipment only when it names the number asked', () => {
    expect(() => parseMailamericas(fixture('in-transit'), DELIVERED))
      .toThrow(expect.objectContaining({ kind: 'indeterminate', message: 'MailAmericas answered for another shipment' }));
    expect(parseMailamericas(changed('in-transit', (data) => { data.trackingNumber = IN_TRANSIT.toLowerCase(); }), IN_TRANSIT).events)
      .toHaveLength(11);
  });

  it('rejects a changed reply', () => {
    for (const change of [
      (_data: Shipment, body: Reply) => { delete (body as Row).data; },
      (_data: Shipment, body: Reply) => { body.data = 'shipment' as never; },
      (data: Shipment) => { delete data.trackingNumber; },
      (data: Shipment) => { data.events = 'events' as never; },
      (data: Shipment) => { data.events = Array.from({ length: 501 }, () => data.events[0]!); },
      (data: Shipment) => { data.events[0] = 'scan' as never; },
      (data: Shipment) => { data.events[0]!.date = '21/05/2026'; },
      (data: Shipment) => { data.events[0]!.time = '09:15:00'; },
      (data: Shipment) => { data.events[0]!.time = '24:00'; },
      (data: Shipment) => { data.events[0]!.date = '2026-02-30'; },
      (data: Shipment) => { delete data.events[0]!.time; },
      (data: Shipment) => { data.events[0]!.description = ['Received']; },
      (data: Shipment) => { data.events[0]!.status = ''; data.events[0]!.description = null; },
      (data: Shipment) => { data.status = 7; },
    ]) {
      expect(() => parseMailamericas(changed('in-transit', change), IN_TRANSIT)).toThrow(expect.objectContaining({ kind: 'schema' }));
    }
  });

  it('keeps an unknown number, a moved route, a refusal, a browser check and a broken reply apart', async () => {
    const lookup = (body: unknown, init?: ResponseInit) => carrier(vi.fn<typeof fetch>().mockResolvedValue(reply(body, init))).track({ number: UNKNOWN });
    await expect(lookup(fixture('not-found'))).rejects.toMatchObject({ kind: 'not_found' });
    // The page reads a missing parcel from a 200 reply: a 404 or a redirect is a moved route.
    await expect(lookup(fixture('not-found'), { status: 404 })).rejects.toMatchObject({ kind: 'transport' });
    await expect(lookup('', { status: 301, headers: { Location: 'https://mailamericas.com/' } })).rejects.toMatchObject({ kind: 'transport' });
    // The balancer turns an address away for a few minutes after a burst of lookups.
    await expect(lookup(BALANCER, { status: 403, headers: { 'Content-Type': 'text/html' } })).rejects.toMatchObject({ kind: 'rate_limited' });
    await expect(lookup('<html><script src="https://sample.awswaf.com/challenge.js"></script></html>', { status: 403 }))
      .rejects.toMatchObject({ kind: 'challenge' });
    await expect(lookup('<html><script>window.gokuProps = {}; AwsWafIntegration.getToken()</script></html>', { headers: { 'Content-Type': 'text/html' } }))
      .rejects.toMatchObject({ kind: 'challenge' });
    await expect(lookup('<html><title>MailAmericas</title></html>')).rejects.toMatchObject({ kind: 'schema' });
    // The service's own failure, which it also gives for numbers it knows.
    await expect(lookup({ error: 'Error al consultar el tracking' }, { status: 500 })).rejects.toMatchObject({ kind: 'indeterminate' });
  });

  it.each([[403, 'challenge'], [429, 'rate_limited'], [500, 'indeterminate'], [502, 'indeterminate'], [503, 'maintenance']] as const)(
    'preserves HTTP %s as %s during retrieval and recognition', async (status, kind) => {
      const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => new Response('', { status }));
      await expect(carrier(fetcher).track({ number: IN_TRANSIT })).rejects.toMatchObject({ kind });
      await expect(carrier(fetcher).recognize!(IN_TRANSIT)).rejects.toMatchObject({ kind });
      expect(fetcher).toHaveBeenCalledTimes(2);
    });

  it('recognizes a known number and the unknown-number answer, and asks nothing for a number MailAmericas does not issue', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(reply(fixture('delivered')))
      .mockResolvedValueOnce(reply(fixture('not-found')));
    // Local clocks cannot date the parcel's last activity.
    await expect(carrier(fetcher).recognize!(DELIVERED)).resolves.toEqual({ known: true, lastActivityAt: null });
    await expect(carrier(fetcher).recognize!(UNKNOWN)).resolves.toEqual({ known: false });
    await expect(carrier(fetcher).recognize!('ML-00')).resolves.toEqual({ known: false });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('rejects numbers MailAmericas does not issue and pre-aborted lookups without a request', async () => {
    const fetcher = vi.fn<typeof fetch>();
    for (const number of ['ML00000', 'SAMPLETRACKING', `ML${'0'.repeat(39)}`]) {
      await expect(carrier(fetcher).track({ number })).rejects.toMatchObject({ kind: 'invalid_input' });
    }
    await expect(carrier(fetcher).track({ number: IN_TRANSIT }, { signal: AbortSignal.abort(new Error('cancelled')) })).rejects.toThrow('cancelled');
    expect(fetcher).not.toHaveBeenCalled();
    expect(normalizeMailamericasNumber('mlar 000-000-002 ex')).toBe(DELIVERED);
  });

  it('gives its one read the whole budget and ends a hanging read inside it', async () => {
    let signal: AbortSignal | undefined;
    const fetcher = vi.fn<typeof fetch>((_input, init) => new Promise((_resolve, reject) => {
      signal = init?.signal ?? undefined;
      signal?.addEventListener('abort', () => reject(signal?.reason), { once: true });
    }));
    const started = Date.now();
    await expect(carrier(fetcher).track({ number: IN_TRANSIT }, { budgetMs: 60 })).rejects.toThrow();
    expect(signal?.aborted).toBe(true);
    expect(Date.now() - started).toBeGreaterThanOrEqual(50);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('routes a number filed under MailAmericas, or detected as one of its numbers, to the adapter', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => reply(fixture('delivered')));
    const tracker = createTracker({ fetcher, providers: [], env: {} });
    await expect(tracker.track({ number: DELIVERED, carrier: 'mailamericas' }, { budgetMs: 3000 }))
      .resolves.toMatchObject({ carrier: 'mailamericas', source: 'mailamericas', result: { current_stage: 'delivered' } });
    await expect(tracker.track({ number: DELIVERED }, { budgetMs: 3000 }))
      .resolves.toMatchObject({ carrier: 'mailamericas', source: 'mailamericas' });
    expect(fetcher.mock.calls.some(([url]) => String(url) === MAILAMERICAS_API)).toBe(true);
  });
});

describe('MailAmericas numbers', () => {
  it('claims its own layouts, whatever the destination country', () => {
    for (const number of [DELIVERED, IN_TRANSIT, UNKNOWN, 'MLUY000000003EX', 'MMXQP000000004R', 'MMXQP000000005E', 'MMXQP000000006N']) {
      expect(detectCarrierMatch(number), number).toMatchObject({ carrier: 'mailamericas', confidence: 'high' });
    }
    for (const number of ['MLAR000000002E', 'MLAR00000002EX', 'MMXQP000000004X', 'ML000000002MH']) {
      expect(detectCarrierMatch(number).carrier, number).not.toBe('mailamericas');
    }
  });

  it('turns the name ParcelsApp reports beside Cainiao into MailAmericas', () => {
    expect(universalCarrierHints(['MailAmericas', 'Cainiao'], 'MLPE000000001R')).toMatchObject({ discovered_carrier: 'mailamericas' });
    expect(universalCarrierHints(['Mail Americas'], 'MMXQP000000004R')).toMatchObject({ discovered_carrier: 'mailamericas' });
  });
});

describe('MailAmericas status vocabulary', () => {
  it('records every code and wording the map knows with the stage it gives', () => {
    for (const entry of statuses.entries as { code: string; wording: string; stage?: string; unmapped?: boolean }[]) {
      if (entry.unmapped) {
        expect(statusMap.stage(entry.code, entry.wording.toLowerCase()), entry.code).toBeUndefined();
        expect(mailamericasStage(entry.code, entry.wording), entry.code).toBeNull();
        expect(statusMapAnswer({ carrier: 'mailamericas', providerCode: entry.code, description: entry.wording }), entry.code)
          .toMatchObject({ kind: 'intentional_gap' });
        continue;
      }
      expect(statusMap.stage(entry.code, entry.wording.toLowerCase()), entry.wording).toBe(entry.stage);
      expect(mailamericasStage(entry.code, entry.wording)?.stage, entry.wording).toBe(entry.stage);
    }
    expect(statusMapAnswer({ carrier: 'mailamericas', providerCode: 'LM-7', description: 'Delivery office: Recipient Absent' }))
      .toEqual({ kind: 'mapped', stage: 'failed_attempt' });
    expect(statusMapAnswer({ carrier: 'mailamericas', providerCode: 'ZZ-9', description: 'Synthetic note' })).toEqual({ kind: 'unknown' });
    // A code the map does not know falls to the shared wording rules.
    expect(mailamericasStage('PF-9', 'Finished: Delivered')).toEqual({ stage: 'delivered', source: 'wording:language' });
    expect(mailamericasStage('ZZ-9', 'Synthetic note')).toBeNull();
    expect(mailamericasStage('sm-9', 'Tax ID: Delivered')).toBeNull();
    expect(mailamericasStage('pf-1', 'Finished: Delivered')).toEqual({ stage: 'delivered', source: 'carrier_map' });
  });
});
