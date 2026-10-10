// @vitest-environment node
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IndeterminateError, NoHistoryError, UpstreamHttpError } from '../../core/errors/index.js';
import type { LookupRecord, StepRecord, StepRecorder } from '../../core/telemetry/index.js';
import { scrapeUniversalPage } from '../../core/transport/browser.js';
import { parseShip24Response, Ship24Tracker } from './adapter.js';
import { ship24Checksum, Ship24HttpClient } from './http.js';

vi.mock('../../core/transport/browser', () => ({ scrapeUniversalPage: vi.fn() }));

const number = 'ZZ12345678900';
const delivered = JSON.parse(readFileSync(new URL('./fixtures/delivered.json', import.meta.url), 'utf8')) as unknown;
const history = { data: { tracking_number: number,
  events: [{ timestamp: '2026-09-10T10:00:00+02:00', status: 'Delivered', dispatch_code_id: 7 }] } };
const reply = (data: unknown) => new Response(JSON.stringify(data), { status: 201 });
const parcelId = '00000000-0000-4000-8000-000000000000';
const stale = (events: unknown[] = history.data.events) => ({ data: { _id: parcelId, tracking_number: number, to_updated: true, events } });

/** The instant of one offset-less noon scan at `location`, or undefined when it stays a wall time. */
function noonAt(location: string | undefined, data: Record<string, unknown> = {}, tracking = number, timezone: string | null = null) {
  const [scan] = parseShip24Response({ data: { tracking_number: tracking, ...data,
    events: [{ timestamp: '2026-09-20T12:00:00', status: 'In transit', location }] } }, tracking, timezone).events!;
  return scan!.time;
}

function fixture(executablePath: string | null = '/test/chromium') {
  const steps: StepRecord[] = [];
  const lookups: LookupRecord[] = [];
  const recorder: StepRecorder = { step: (record) => { steps.push(record); }, lookup: (record) => { lookups.push(record); } };
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => reply(history));
  const client = new Ship24HttpClient(fetcher);
  return { client, fetcher, steps, lookups,
    tracker: new Ship24Tracker({ httpClient: client, executablePath: executablePath ?? undefined, recorder }) };
}
afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); });

describe('Ship24 result parsing', () => {
  it('retains the aggregated history, scan places and courier names without recipient or courier contact details', () => {
    const parsed = parseShip24Response(delivered, number);
    expect(parsed).toMatchObject({ status: 'delivered', current_stage: 'delivered', tracking_provider: 'Ship24' });
    expect(parsed.events?.length).toBeGreaterThan(0);
    expect(parsed.events?.[0]).toMatchObject({ stage: 'delivered', description: 'Delivered' });
    // A place holding private delivery details is dropped.
    expect(parsed.events?.[0]?.location).toBeUndefined();
    expect(parsed.events?.[1]).toMatchObject({ description: 'Out for delivery', location: 'Example Town, CH' });
    expect(parsed.reported_carriers).toEqual(['Swiss Post', 'UPS']);
    // A single unambiguous name may be adopted; several names stay hints only.
    expect(parsed.discovered_carrier).toBeUndefined();
    expect(JSON.stringify(parsed)).not.toMatch(/PRIVATE|PIN:|signed by/i);
  });

  it('reads offset-less scans named "Correos de España" on Correos\'s Madrid clock', () => {
    const result = parseShip24Response({ data: { tracking_number: number,
      couriers: [{ translation: { name: 'Correos de España' } }],
      events: [{ timestamp: '2026-07-02T18:30:00', status: 'Delivered', dispatch_code_id: 7 },
        { timestamp: '2026-01-14T09:15:00', status: 'Admitted' }] } }, number);
    expect(result.events?.map((scan) => scan.time)).toEqual(['2026-07-02T16:30:00.000Z', '2026-01-14T08:15:00.000Z']);
    expect(result).toMatchObject({ reported_carriers: ['Correos de España'], discovered_carrier: 'correos-spain' });
  });

  it('gives a Posti scan abroad no location rather than Posti\'s "abroad" label', () => {
    const result = parseShip24Response({ data: { tracking_number: number, couriers: [{ translation: { name: 'Posti' } }],
      events: [{ timestamp: '2026-01-13T18:00:00+02:00', status: 'Item has arrived to destination country', location: 'ULKOMAILLA' },
        { timestamp: '2026-01-11T22:00:00+02:00', status: 'The item is on its way to the destination country.', location: 'EXAMPLE AIRPORT' }] } }, number);
    expect(result.events?.[0]?.location).toBeUndefined();
    expect(result.events?.[1]?.location).toBe('EXAMPLE AIRPORT');
  });

  it('keeps "DHL Express" a reported name for a waybill whose check digit DHL Express refuses', () => {
    const named = (waybill: string) => parseShip24Response({ data: { tracking_number: waybill,
      couriers: [{ translation: { name: 'DHL Express' } }], events: history.data.events } }, waybill);
    expect(named('1234567890')).toMatchObject({ reported_carriers: ['DHL Express'] });
    expect(named('1234567890').discovered_carrier).toBeUndefined();
    expect(named('1234567891').discovered_carrier).toBe('dhl-express');
  });

  it('leaves out a scan dated without a time instead of failing the history', () => {
    const parsed = parseShip24Response({ data: { tracking_number: number, events: [...history.data.events,
      { timestamp: '2026-09-08', status: 'The shipment has been created by the sender' }] } }, number);
    expect(parsed.events?.map((scan) => scan.description)).toEqual(['Delivered']);
  });

  it('rejects history that belongs to another shipment', () => {
    expect(() => parseShip24Response({ data: { tracking_number: 'OTHER123', events: [] } }, number))
      .toThrow('no matching shipment history');
  });

  it('reports a matching reply with only a notice as inconclusive, never as a reply of the wrong shape', () => {
    const parse = () => parseShip24Response({ data: { tracking_number: number,
      events: [{ timestamp: '2026-09-10T10:00:00+02:00', status: 'Tracking number not found' }] } }, number);
    expect(parse).toThrow(IndeterminateError);
    expect(parse).toThrow(expect.objectContaining({ kind: 'indeterminate', provider: 'Ship24', message: 'No usable tracking events' }));
  });

  it('reports a known parcel without scans as having no history, unless Ship24 has yet to ask the carriers', () => {
    for (const events of [[], undefined]) {
      expect(() => parseShip24Response({ data: { tracking_number: number, events } }, number)).toThrow(NoHistoryError);
    }
    const pending = () => parseShip24Response(stale([]), number);
    expect(pending).toThrow(IndeterminateError);
    expect(pending).not.toThrow(NoHistoryError);
  });

  it.each([
    ['Kuwait', '2026-09-20T09:00:00.000Z'], ['Example Hub, Saudi Arabia', '2026-09-20T09:00:00.000Z'],
    ['КИТАЙ', '2026-09-20T04:00:00.000Z'], ['Example (CZ)', '2026-09-20T10:00:00.000Z'],
    ['EXAMPLE - CHINA', '2026-09-20T04:00:00.000Z'], ['Example Town, ON, Canada', '2026-09-20T16:00:00.000Z'],
  ])('reads an offset-less scan at %s on that place\'s clock, whichever courier relayed it', (location, time) => {
    expect(noonAt(location, { couriers: [{ translation: { name: 'Correos de España' } }] })).toBe(time);
  });

  it('reads a US state or Canadian province only for a parcel in North America or a town that lies there', () => {
    expect(noonAt('Example Town, TX', { origin_country_code: 'CN', destination_country_code: 'US' })).toBe('2026-09-20T17:00:00.000Z');
    expect(noonAt('Example Town, ON', { origin_country_code: 'CN', destination_country_code: 'CA' })).toBe('2026-09-20T16:00:00.000Z');
    // An Italian province is no state.
    expect(noonAt('MILANO MI', { origin_country_code: 'CN', destination_country_code: 'IT' })).toBeUndefined();
  });

  it('places an unlocated scan of a parcel that stays in one country there', () => {
    expect(noonAt(undefined, { origin_country_code: 'PL', destination_country_code: 'PL' })).toBe('2026-09-20T10:00:00.000Z');
    // An S10 item's suffix is its origin; Ship24 can still write the UK as "UK".
    expect(noonAt(undefined, { destination_country_code: 'PL' }, 'ZZ123456785PL')).toBe('2026-09-20T10:00:00.000Z');
    expect(noonAt(undefined, { origin_country_code: 'UK', destination_country_code: 'GB' })).toBe('2026-09-20T11:00:00.000Z');
  });

  it('places a cross-border item\'s UPU events on the side of the border their words name, until it is sent back', () => {
    const upu = { translation: { name: 'UPU' } };
    const walls = (origin: string) => parseShip24Response({ data: { tracking_number: 'ZZ123456785CH',
      origin_country_code: origin, destination_country_code: 'CN', events: [
        { timestamp: '2026-09-12T10:00:00', status: 'Departure from outward office of exchange', location: 'EXAMPLE 2', courier: upu },
        { timestamp: '2026-09-10T10:00:00', status: 'Unsuccessful delivery, Incorrect Address/Item returned to sender', courier: upu },
        { timestamp: '2026-09-08T10:00:00', status: 'Arrival at inward office of exchange', location: 'EXAMPLE', courier: upu },
        { timestamp: '2026-09-06T10:00:00', status: 'In transit', courier: upu },
        { timestamp: '2026-09-04T10:00:00', status: 'Posting/Collection', location: 'EXAMPLE 1', courier: upu },
      ] } }, 'ZZ123456785CH').events!.map((scan) => scan.time ?? scan.local_time);
    expect(walls('CH')).toEqual(['2026-09-12T10:00:00', '2026-09-10T02:00:00.000Z', '2026-09-08T02:00:00.000Z',
      '2026-09-06T10:00:00', '2026-09-04T08:00:00.000Z']);
    // A Swiss number posted in Germany was posted at an office of exchange abroad.
    expect(walls('DE').at(-1)).toBe('2026-09-04T10:00:00');
  });

  it('leaves an unlocated scan of a cross-border parcel a wall time, not on its relay\'s or carrier\'s clock', () => {
    const correos = { couriers: [{ translation: { name: 'Correos de España' } }] };
    expect(noonAt(undefined, correos)).toBe('2026-09-20T10:00:00.000Z');
    expect(noonAt(undefined, { ...correos, origin_country_code: 'ES', destination_country_code: 'CN' })).toBeUndefined();
    expect(noonAt(undefined, { destination_country_code: 'SV' }, 'ZZ123456785CH', 'Europe/Zurich')).toBeUndefined();
    expect(noonAt(undefined, {}, number, 'Europe/Zurich')).toBe('2026-09-20T10:00:00.000Z');
  });
});

describe('Ship24 anonymous HTTP tracking', () => {
  it('makes one signed JSON POST per lookup with no browser, bootstrap, cookie or login', async () => {
    const { tracker, fetcher, steps, lookups } = fixture();
    for (let index = 0; index < 2; index++) {
      await expect(tracker.fetch(number)).resolves.toMatchObject({ current_stage: 'delivered', tracking_source: 'structured-web-response' });
    }
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(scrapeUniversalPage).not.toHaveBeenCalled();
    expect(steps.map(({ step, outcome }) => [step, outcome])).toEqual([['direct', 'ok'], ['direct', 'ok']]);
    expect(lookups.map(({ carrier, finalStep, outcome }) => [carrier, finalStep, outcome]))
      .toEqual([['Ship24', 'direct', 'ok'], ['Ship24', 'direct', 'ok']]);
    const [url, init] = fetcher.mock.calls[0]!;
    expect(String(url)).toBe(`https://api.ship24.com/api/parcels/${number}?lang=en`);
    expect(init).toMatchObject({ method: 'POST', redirect: 'error', cache: 'no-store' });
    const headers = init!.headers as Record<string, string>;
    const [encoded, signature] = headers['x-ship24-token']!.split('.') as [string, string];
    expect(signature).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.parse(Buffer.from(encoded, 'base64').toString())).toMatchObject({ a: expect.any(Number), b: expect.any(Number), c: expect.stringMatching(/^[a-f0-9]{64}$/) });
    expect(headers).not.toHaveProperty('Cookie');
    expect(headers).not.toHaveProperty('Authorization');
  });

  it('uses standard unsigned MurmurHash3 checksums and binds tokens to the requested number', async () => {
    expect(ship24Checksum('')).toBe(0);
    expect(ship24Checksum('hello')).toBe(613153351);
    expect(ship24Checksum('foo')).toBe(4138058784);
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    const { client, fetcher } = fixture();
    await client.fetch(number, 1000);
    await client.fetch('ZZ12345678901', 1000);
    const tokens = fetcher.mock.calls.map(([, init]) => (init!.headers as Record<string, string>)['x-ship24-token']);
    expect(tokens[0]).not.toBe(tokens[1]);
  });

  it('records the rejected HTTP path before browser recovery starts', async () => {
    const { tracker, fetcher, steps } = fixture();
    fetcher.mockResolvedValueOnce(new Response('rejected', { status: 403 }));
    vi.mocked(scrapeUniversalPage).mockImplementationOnce(async () => {
      expect(steps).toMatchObject([{ carrier: 'Ship24', step: 'direct', outcome: 'challenge', errorType: 'UpstreamHttpError' }]);
      return { events: [], status: 'delivered' };
    });
    await expect(tracker.fetch(number)).resolves.toMatchObject({ tracking_source: 'browser-session-response' });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(steps[1]).toMatchObject({ step: 'browser', outcome: 'ok', fallbackFrom: 'direct', fallbackReason: 'challenge' });
  });

  it('reports the rejected HTTP path itself when no Chromium is configured', async () => {
    const { tracker, fetcher, steps, lookups } = fixture(null);
    fetcher.mockResolvedValueOnce(new Response('rejected', { status: 403 }));
    await expect(tracker.fetch(number)).rejects.toMatchObject({ status: 403, kind: 'challenge' });
    expect(scrapeUniversalPage).not.toHaveBeenCalled();
    expect(steps.map(({ step, outcome }) => [step, outcome])).toEqual([['direct', 'challenge']]);
    expect(lookups).toMatchObject([{ finalStep: 'direct', outcome: 'challenge', stepsAvailable: 1 }]);
  });

  it.each([429, 503])('preserves HTTP %i and Retry-After without browser amplification', async (status) => {
    const { tracker, fetcher } = fixture();
    fetcher.mockResolvedValueOnce(new Response('', { status, headers: { 'Retry-After': '120' } }));
    await expect(tracker.fetch(number)).rejects.toMatchObject({ status, retryAfterMs: 120_000 });
    expect(scrapeUniversalPage).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it.each([404, 410])('reports HTTP %i as not found without waiting for the browser', async (status) => {
    const { tracker, fetcher, steps } = fixture();
    fetcher.mockResolvedValueOnce(new Response('', { status }));
    await expect(tracker.fetch(number)).rejects.toMatchObject({ status, kind: 'not_found' });
    expect(scrapeUniversalPage).not.toHaveBeenCalled();
    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({ step: 'direct', outcome: 'not_found' });
  });

  it('reports a history without usable scans as inconclusive when no Chromium is configured', async () => {
    const { tracker, fetcher, steps } = fixture(null);
    fetcher.mockResolvedValueOnce(reply({ data: { tracking_number: number,
      events: [{ timestamp: '2026-09-10T10:00:00+02:00', status: 'Tracking number not found' }] } }));
    await expect(tracker.fetch(number)).rejects.toMatchObject({ kind: 'indeterminate', message: 'No usable tracking events' });
    expect(steps.map(({ step, outcome, errorType }) => [step, outcome, errorType])).toEqual([['direct', 'indeterminate', 'IndeterminateError']]);
  });

  it('asks Ship24 to query the carriers again when the stored parcel says so, as the web app does', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    const { tracker, fetcher } = fixture();
    fetcher.mockResolvedValueOnce(reply(stale([])));
    await expect(tracker.fetch(number)).resolves.toMatchObject({ current_stage: 'delivered', tracking_source: 'structured-web-response' });
    expect(fetcher).toHaveBeenCalledTimes(2);
    const [url, init] = fetcher.mock.calls[1]!;
    expect(String(url)).toBe(`https://api.ship24.com/api/parcels/update/${parcelId}/mainTN/${number}?lang=en`);
    expect(init).toMatchObject({ method: 'POST' });
    // Decimal UTF-8 bytes of the markers, the time and the number, two bytes changed to 150.
    const signature = (init!.headers as Record<string, string>)['x-ship24-token']!;
    expect(Buffer.from(signature.split(',').map(Number)).toString()).toBe(`\u1580,1000000,\u1782,${number},\u1581`);
    expect(scrapeUniversalPage).not.toHaveBeenCalled();
  });

  it('keeps a stored history when its refresh fails or takes too long', async () => {
    const { client, tracker, fetcher } = fixture();
    const refresh = vi.spyOn(client, 'refresh');
    fetcher.mockResolvedValueOnce(reply(stale())).mockRejectedValueOnce(new TypeError('fetch failed'));
    await expect(tracker.fetch(number)).resolves.toMatchObject({ current_stage: 'delivered', tracking_source: 'structured-web-response' });
    expect(refresh).toHaveBeenCalledWith(parcelId, number, 15_000, expect.anything());
    expect(scrapeUniversalPage).not.toHaveBeenCalled();
  });

  it('reports a parcel Ship24 still has no scans for after the refresh, without the browser', async () => {
    const { tracker, fetcher, steps } = fixture();
    fetcher.mockResolvedValueOnce(reply(stale([]))).mockResolvedValueOnce(reply({ data: { tracking_number: number, events: [] } }));
    await expect(tracker.fetch(number)).rejects.toThrow(NoHistoryError);
    expect(scrapeUniversalPage).not.toHaveBeenCalled();
    expect(steps.map(({ step, errorType }) => [step, errorType])).toEqual([['direct', 'NoHistoryError']]);
  });

  it('lets the browser try when the refresh of a parcel without scans fails', async () => {
    const { tracker, fetcher } = fixture();
    fetcher.mockResolvedValueOnce(reply(stale([]))).mockRejectedValueOnce(new TypeError('fetch failed'));
    vi.mocked(scrapeUniversalPage).mockResolvedValueOnce({ events: [], status: 'delivered' });
    await expect(tracker.fetch(number)).resolves.toMatchObject({ tracking_source: 'browser-session-response' });
  });

  it('gives the direct request all of the budget but the browser\'s reserve', async () => {
    vi.spyOn(performance, 'now').mockReturnValue(1000);
    for (const [executablePath, budget, direct] of [['/test/chromium', 45_000, 35_000], ['/test/chromium', 12_000, 6000], [null, 45_000, 45_000]] as const) {
      const { client, tracker } = fixture(executablePath);
      const fetch = vi.spyOn(client, 'fetch');
      await tracker.fetch(number, budget);
      expect(fetch).toHaveBeenCalledWith(number, direct, expect.anything());
    }
  });

  it('rejects unrelated history before falling back and does not leak it into the result', async () => {
    const { tracker, fetcher, steps } = fixture();
    fetcher.mockResolvedValueOnce(reply({ data: { ...history.data, tracking_number: 'OTHER123' } }));
    vi.mocked(scrapeUniversalPage).mockRejectedValueOnce(new UpstreamHttpError('Ship24', 403));
    await expect(tracker.fetch(number)).rejects.toMatchObject({ status: 403 });
    expect(steps[1]).toMatchObject({ step: 'browser', fallbackFrom: 'direct', fallbackErrorType: 'SchemaError' });
  });

  it('validates inputs before network access', async () => {
    const { client, fetcher } = fixture();
    await expect(client.fetch('https://private.test', 1000)).rejects.toThrow('tracking number');
    await expect(client.fetch(number, Infinity)).rejects.toThrow('timeout');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('subtracts direct time from the browser budget', async () => {
    let clock = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => clock);
    const { client, tracker } = fixture();
    vi.spyOn(client, 'fetch').mockImplementationOnce(async () => { clock += 7500; throw new Error('timeout'); });
    vi.mocked(scrapeUniversalPage).mockResolvedValueOnce({ events: [] });
    await tracker.fetch(number);
    expect(scrapeUniversalPage).toHaveBeenCalledWith(expect.objectContaining({ timeoutMs: 37_500 }), expect.anything(), expect.anything());
  });

  it('ends the browser recovery when the caller cancels', async () => {
    const { tracker, fetcher } = fixture();
    fetcher.mockResolvedValueOnce(new Response('rejected', { status: 403 }));
    vi.mocked(scrapeUniversalPage).mockImplementationOnce(({ signal }) => new Promise((_, reject) => {
      signal!.addEventListener('abort', () => reject(signal!.reason), { once: true });
    }));
    const controller = new AbortController();
    const lookup = tracker.fetch(number, undefined, null, controller.signal);
    await vi.waitFor(() => expect(scrapeUniversalPage).toHaveBeenCalledOnce());
    controller.abort(new Error('caller cancelled'));
    await expect(lookup).rejects.toThrow('caller cancelled');
  });

  it('runs the browser alone when no signed HTTP client is configured', async () => {
    vi.mocked(scrapeUniversalPage).mockResolvedValueOnce({ events: [], status: 'delivered' });
    await expect(new Ship24Tracker({ executablePath: '/test/chromium' }).fetch(number))
      .resolves.toMatchObject({ tracking_source: 'browser-session-response' });
    await expect(new Ship24Tracker({ executablePath: '/test/chromium', timeoutMs: Infinity }).fetch(number)).rejects.toThrow('timeout');
  });
});
