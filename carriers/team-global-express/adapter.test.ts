import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { statusMapAnswer } from '../../core/catalog/statusMaps.js';
import { detectCarrierMatch } from '../../core/detection/index.js';
import { NOOP_RECORDER } from '../../core/telemetry/index.js';
import { createTracker } from '../../facade/index.js';
import { adapter, TeamGlobalExpressTracker, TGE_DETAILS, TGE_SEARCH } from './adapter.js';
import { normalizeTeamGlobalExpressNumber, parseTeamGlobalExpressDetails, parseTeamGlobalExpressSearch, teamGlobalExpressSearchUrl } from './parser.js';
import { statusMap, teamGlobalExpressStage } from './status.js';
import statuses from './statuses.json' with { type: 'json' };

const DELIVERED = '9900000000017';
const IN_TRANSIT = 'SMPL000001';
const UNKNOWN = '9900000000000';
const REFERENCE = 'ORDER0000123';
const DELIVERED_ID = '0f1e2d3c4b5a69788796a5b4c3d2e1f00f1e2d3c';
const IN_TRANSIT_ID = '1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d';

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}.html`, import.meta.url), 'utf8');
type Row = Record<string, unknown>;
/** A shipment page with its script's shipment or scans changed. */
const page = (name: string, change: (summary: Row, events: Row[]) => void) => {
  const html = fixture(name);
  const read = (key: string) => JSON.parse(new RegExp(`var ${key} = (.+);$`, 'm').exec(html)![1]!) as unknown;
  const summary = read('courierStopList') as Row;
  const events = read('eventsBeanList') as Row[];
  change(summary, events);
  return html.replace(/var courierStopList = .+;$/m, () => `var courierStopList = ${JSON.stringify(summary)};`)
    .replace(/var eventsBeanList = .+;$/m, () => `var eventsBeanList = ${JSON.stringify(events)};`);
};
const delivered = (html = fixture('details-delivered')) => parseTeamGlobalExpressDetails(html, DELIVERED, { id: DELIVERED_ID, shipment: DELIVERED });
const inTransit = (html = fixture('details-in-transit')) => parseTeamGlobalExpressDetails(html, IN_TRANSIT, { id: IN_TRANSIT_ID, shipment: IN_TRANSIT });
const reply = (body: string, status = 200, headers: Record<string, string> = {}) => new Response(body,
  { status, headers: { 'Content-Type': 'text/html;charset=UTF-8', ...headers } });
type Reply = string | (() => Response | Promise<Response>);
/** MyTeamGE's two pages: the quick search's answer and the shipment page. */
const site = (search: Reply, details: Reply) => vi.fn<typeof fetch>().mockImplementation(async (url) => {
  const answer = String(url).startsWith(`${TGE_SEARCH}?`) ? search : details;
  return typeof answer === 'string' ? reply(answer) : answer();
});
const carrier = (fetcher: typeof fetch) => adapter({ fetcher, recorder: NOOP_RECORDER, env: {}, trawl: null, browserExecutablePath: null });

describe('Team Global Express HTTP adapter', () => {
  it('asks the quick search for the number and opens the shipment page of its row, through the supplied transport', async () => {
    const fetcher = site(fixture('search-in-transit'), fixture('details-in-transit'));
    const recorder = { ...NOOP_RECORDER, step: vi.fn(), lookup: vi.fn() };
    await expect(new TeamGlobalExpressTracker({ fetcher, recorder, userAgent: 'SyntheticHost/1.0' }).fetch(' smpl-000001 ', { budgetMs: 1000.5 }))
      .resolves.toMatchObject({ current_stage: 'in_transit' });
    expect(fetcher).toHaveBeenCalledTimes(2);
    const headers = { Accept: 'text/html', 'User-Agent': 'SyntheticHost/1.0' };
    const [search, details] = fetcher.mock.calls.map(([url, init]) => [new URL(String(url)), init] as const);
    expect(`${search![0].origin}${search![0].pathname}`).toBe(TGE_SEARCH);
    expect(Object.fromEntries(search![0].searchParams)).toEqual({ p_p_id: 'searchportlet_WAR_searchportlet', p_p_lifecycle: '2',
      p_p_state: 'normal', p_p_mode: 'view', p_p_resource_id: 'quickSearch', p_p_cacheability: 'cacheLevelPage', company: IN_TRANSIT,
      _searchportlet_WAR_searchportlet_shipmentReferences: IN_TRANSIT, _searchportlet_WAR_searchportlet_externalSearchQuery: '' });
    expect(String(details![0])).toBe(`${TGE_DETAILS}?consignmentId=${IN_TRANSIT_ID}`);
    for (const [, init] of [search!, details!]) {
      expect(init).toMatchObject({ method: 'GET', redirect: 'manual', headers, signal: expect.any(AbortSignal) });
    }
    expect(recorder.step).toHaveBeenCalledWith(expect.objectContaining({ carrier: 'team-global-express', step: 'direct', outcome: 'ok' }));
    expect(recorder.lookup).toHaveBeenCalledTimes(1);
    expect(teamGlobalExpressSearchUrl(IN_TRANSIT)).toBe(String(search![0]));
  });

  it('lists the scans newest first with their wall clocks, codes and suburbs', () => {
    const result = delivered();
    expect(result).toMatchObject({ status: 'delivered', current_stage: 'delivered', current_stage_source: 'carrier_map',
      last_status_text: 'FREIGHT DELIVERED', last_update: null, last_update_local: '2026-09-22T13:42:00', expected_delivery: null,
      service_name: 'Road Express', weight_kg: 5.6, destination_country: 'AU' });
    expect(result.events!.map((event) => [event.local_time, event.provider_code, event.stage ?? null, event.location ?? null])).toEqual([
      ['2026-09-22T13:42:00', '1$$8', 'delivered', 'TESTBURY'],
      ['2026-09-22T10:05:00', '1$$9', 'out_for_delivery', 'TESTBURY'],
      ['2026-09-19T08:58:00', '2$$HC', 'ready_for_pickup', 'TESTBURY'],
      ['2026-09-18T10:00:00', '2$$HC', 'ready_for_pickup', 'TESTBURY'],
      ['2026-09-17T18:27:00', '2$$TT', 'failed_attempt', 'TESTBURY'],
      ['2026-09-17T09:45:00', '1$$9', 'out_for_delivery', 'TESTBURY'],
      // The repeated depot scan is kept once, by the clock the page shows rather than its Sydney twin.
      ['2026-09-15T06:27:00', '1$$2', 'in_transit', 'TESTBURY'],
      ['2026-09-14T17:29:00', '6$$A00005', 'in_transit', 'SAMPLE CITY'],
      ['2026-09-14T15:12:00', '1$$1', 'accepted', 'SAMPLETON'],
      // The network's own record is in no place.
      ['2026-09-14T10:54:00', '1$$0', 'registered', null],
    ]);
    expect(result.events!.every((event) => event.time === undefined && event.stage_source === 'carrier_map')).toBe(true);
    expect(result).not.toHaveProperty('canonical_tracking_number');
    // Who signed, the sender's references and the page's own id are not kept.
    expect(JSON.stringify(result)).not.toMatch(/SAMPLE SIGNER|SAMPLE ORDER|0f1e2d3c|Sampleton, VIC|00093500000000017013/);
  });

  it('keeps a state where the scan names one and the estimate while the parcel is on its way', () => {
    const result = inTransit();
    expect(result).toMatchObject({ status: 'in_transit', current_stage: 'in_transit', current_stage_source: 'carrier_map',
      last_status_text: 'Processed in Depot PM', last_update_local: '2026-10-08T06:32:00', expected_delivery: '2026-10-20',
      service_name: 'Global Express', weight_kg: 1.6, destination_country: 'AU' });
    expect(result.events!.map((event) => [event.local_time, event.location, event.description])).toEqual([
      ['2026-10-08T06:32:00', 'EXAMPLEVILLE, VIC', 'Processed in Depot PM'],
      ['2026-10-07T16:51:00', 'EXAMPLE PARK, NSW', 'Depot Scan'],
      ['2026-10-07T16:50:00', 'Example City', 'Into Depot'],
      ['2026-10-07T16:50:00', 'Example City', 'Linehaul to destination depot: Overnight'],
      ['2026-10-05T22:00:00', 'Sample City', 'Linehaul to destination depot: Overnight'],
      ['2026-10-05T05:22:00', 'SAMPLELAND', 'Electronic Billing Transfer'],
    ]);
    // An oldest-first page and a newest-first one read the same.
    expect(inTransit(page('details-in-transit', (_summary, events) => { events.reverse(); })).events).toEqual(result.events);
    // No weight, an empty estimate or a country that is not a code is left out.
    const sparse = inTransit(page('details-in-transit', (summary) => {
      Object.assign(summary, { totalWeights: '0', eta: null, receiverLocation: { suburb: 'EXAMPLEVILLE', country: 'Australia' } });
      delete summary.serviceType;
    }));
    expect(sparse).toMatchObject({ expected_delivery: null });
    for (const key of ['weight_kg', 'destination_country', 'service_name']) expect(sparse).not.toHaveProperty(key);
  });

  it('takes the shipment’s milestone for a collection, a cancellation or a partial delivery', () => {
    expect(inTransit(page('details-in-transit', (summary) => { summary.status = 'COLLCTD'; })))
      .toMatchObject({ status: 'delivered', current_stage: 'delivered', current_stage_source: 'carrier_map', expected_delivery: null });
    expect(inTransit(page('details-in-transit', (summary) => { summary.status = 'CANCLD'; })))
      .toMatchObject({ status: 'exception', current_stage: 'exception', current_stage_source: 'carrier_map' });
    expect(delivered(page('details-delivered', (summary) => { summary.status = 'PRTDEL'; })))
      .toMatchObject({ current_stage: 'in_transit', current_stage_source: 'carrier_map', expected_delivery: '2026-09-18' });
    // A newer scan than the milestone settles the rest.
    expect(inTransit(page('details-in-transit', (summary) => { summary.status = 'AWTCOL'; })))
      .toMatchObject({ current_stage: 'in_transit' });
  });

  it('stages a code it does not know by an attempted delivery, its milestone or its wording', () => {
    const scan = (event: Row) => inTransit(page('details-in-transit', (_summary, events) => { Object.assign(events.at(-1)!, event); })).events![0];
    expect(scan({ eventCode: '81$$CL', status: 'INTRNST', eventDesc: 'Card Left', isException: true, exception: { type: 'Attempted delivery' } }))
      .toMatchObject({ provider_code: '81$$CL', stage: 'failed_attempt', stage_source: 'carrier_map' });
    expect(scan({ eventCode: '6$$A00009', status: 'INTRNST', eventDesc: 'SORTED TO CHUTE' }))
      .toMatchObject({ stage: 'in_transit', stage_source: 'carrier_map' });
    expect(scan({ eventCode: '77', status: '', eventDesc: 'Delivered to the receiver' }))
      .toMatchObject({ stage: 'delivered', stage_source: expect.stringMatching(/^wording:/) });
    expect(scan({ eventCode: '77', status: '', eventDesc: 'Synthetic note' })).not.toHaveProperty('stage');
  });

  it('finds a shipment its references name and reports its own number', async () => {
    const search = fixture('search-in-transit').replace(`<span class="srch-term"> ${IN_TRANSIT}</span>`, `<span class="srch-term"> ${REFERENCE}</span>`);
    expect(parseTeamGlobalExpressSearch(search, REFERENCE)).toEqual({ id: IN_TRANSIT_ID, shipment: IN_TRANSIT });
    await expect(carrier(site(search, fixture('details-in-transit'))).track({ number: REFERENCE }))
      .resolves.toMatchObject({ canonical_tracking_number: IN_TRANSIT, current_stage: 'in_transit' });
  });

  it('reads the search’s empty answer as not found and a page without the shipment as inconclusive', async () => {
    expect(() => parseTeamGlobalExpressSearch(fixture('search-not-found'), UNKNOWN)).toThrow(expect.objectContaining({ kind: 'not_found' }));
    await expect(carrier(site(fixture('search-not-found'), '')).track({ number: UNKNOWN })).rejects.toMatchObject({ kind: 'not_found' });
    expect(() => delivered(fixture('details-missing'))).toThrow(expect.objectContaining({ kind: 'indeterminate' }));
    expect(() => delivered(page('details-delivered', (_summary, events) => { events.length = 0; })))
      .toThrow(expect.objectContaining({ kind: 'indeterminate', name: 'NoHistoryError' }));
  });

  it('counts a shipment only when the search and the page name the number asked', () => {
    const search = fixture('search-delivered');
    expect(parseTeamGlobalExpressSearch(search, DELIVERED)).toEqual({ id: DELIVERED_ID, shipment: DELIVERED });
    for (const [html, number] of [
      [search, '9900000000024'],
      [search.replace(`<span class="shipNo">${DELIVERED}`, '<span class="shipNo">9900000000024'), DELIVERED],
      [search.replace(/(<tr class="grid-row data-row[\s\S]*?<\/tr>)/, '$1$1'), DELIVERED],
    ] as const) {
      expect(() => parseTeamGlobalExpressSearch(html, number), number).toThrow(expect.objectContaining({ kind: 'indeterminate' }));
    }
    expect(() => delivered(page('details-delivered', (summary) => { summary.consignmentNumber = '9900000000024'; })))
      .toThrow(expect.objectContaining({ kind: 'indeterminate', message: 'Team Global Express answered for another shipment' }));
    expect(() => delivered(page('details-delivered', (summary) => { summary.consignmentId = IN_TRANSIT_ID; })))
      .toThrow(expect.objectContaining({ kind: 'indeterminate' }));
  });

  it('rejects a changed search answer or shipment page', () => {
    for (const html of [
      '<div>Track your shipment</div>',
      fixture('search-delivered').replace('id="quickSearchTableResult"', 'id="results"'),
      fixture('search-delivered').replace('<b>1 shipment</b>', '<b>one shipment</b>'),
      fixture('search-delivered').replace(`data-refnum="${DELIVERED_ID}"`, 'data-refnum="../../login"'),
      fixture('search-not-found').replace('no-res-found', 'no-results'),
    ]) expect(() => parseTeamGlobalExpressSearch(html, html.includes(UNKNOWN) ? UNKNOWN : DELIVERED)).toThrow(expect.objectContaining({ kind: 'schema' }));
    for (const html of [
      fixture('details-delivered').replace('var eventsBeanList', 'var eventsList'),
      fixture('details-delivered').replace('var courierStopList = {', 'var courierStopList = {{'),
      page('details-delivered', (_summary, events) => { events[0] = 'scan' as never; }),
      page('details-delivered', (_summary, events) => { events[0]!.dateTimeStamp = '2026-09-14 10:54'; }),
      page('details-delivered', (_summary, events) => { events[0]!.dateTimeStamp = '31-09-2026 10:54 AM'; }),
      page('details-delivered', (_summary, events) => { events[0]!.dateTimeStamp = '14-09-2026 13:54 PM'; }),
      page('details-delivered', (_summary, events) => { events[0]!.eventDesc = ''; }),
      page('details-delivered', (_summary, events) => { events[0]!.eventDesc = ['Into Depot']; }),
      page('details-delivered', (_summary, events) => { events[0]!.location = 'TESTBURY'; }),
      page('details-delivered', (_summary, events) => { events.push(...Array.from({ length: 1000 }, () => events[0]!)); }),
    ]) expect(() => delivered(html)).toThrow(expect.objectContaining({ kind: 'schema' }));
    expect(() => delivered(fixture('details-delivered').replace(/var eventsBeanList = .+;$/m, 'var eventsBeanList = "none";')))
      .toThrow(expect.objectContaining({ kind: 'schema' }));
  });

  it('keeps a firewall’s CAPTCHA, a refusal, a browser check, a moved route and an outage apart', async () => {
    const lookup = (search: Reply) => carrier(site(search, fixture('details-delivered'))).track({ number: DELIVERED });
    // AWS's firewall asks for a CAPTCHA after a burst of lookups.
    await expect(lookup(() => reply('<html>captcha</html>', 405, { 'x-amzn-waf-action': 'captcha' }))).rejects.toMatchObject({ kind: 'rate_limited' });
    await expect(lookup(() => reply('', 429))).rejects.toMatchObject({ kind: 'rate_limited' });
    await expect(lookup(() => reply('<html>Request blocked</html>', 403))).rejects.toMatchObject({ kind: 'challenge' });
    await expect(lookup(() => reply('', 202, { 'x-amzn-waf-action': 'challenge' }))).rejects.toMatchObject({ kind: 'challenge' });
    await expect(lookup('<html><script src="https://sample.edge.captcha-sdk.awswaf.com/sample/jsapi.js"></script></html>'))
      .rejects.toMatchObject({ kind: 'challenge' });
    await expect(lookup(() => reply('', 302, { Location: 'https://www.myteamge.com/' }))).rejects.toMatchObject({ kind: 'transport' });
    await expect(lookup(() => reply('', 404))).rejects.toMatchObject({ kind: 'transport' });
    await expect(lookup(() => reply('', 500))).rejects.toMatchObject({ kind: 'indeterminate' });
    await expect(lookup(() => reply('', 503))).rejects.toMatchObject({ kind: 'maintenance' });
    // The shipment page goes through the same checks.
    await expect(carrier(site(fixture('search-delivered'), () => reply('', 403))).track({ number: DELIVERED })).rejects.toMatchObject({ kind: 'challenge' });
  });

  it.each([[403, 'challenge'], [405, 'rate_limited'], [429, 'rate_limited'], [502, 'indeterminate'], [503, 'maintenance']] as const)(
    'preserves HTTP %s as %s during retrieval and recognition', async (status, kind) => {
      const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => new Response('', { status }));
      await expect(carrier(fetcher).track({ number: IN_TRANSIT })).rejects.toMatchObject({ kind });
      await expect(carrier(fetcher).recognize!(IN_TRANSIT)).rejects.toMatchObject({ kind });
      expect(fetcher).toHaveBeenCalledTimes(2);
    });

  it('recognizes a known number and the empty answer, and asks nothing for a number Team Global Express does not issue', async () => {
    await expect(carrier(site(fixture('search-delivered'), fixture('details-delivered'))).recognize!(DELIVERED))
      .resolves.toEqual({ known: true, lastActivityAt: null });
    const fetcher = site(fixture('search-not-found'), '');
    await expect(carrier(fetcher).recognize!(UNKNOWN)).resolves.toEqual({ known: false });
    await expect(carrier(fetcher).recognize!('TGE')).resolves.toEqual({ known: false });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('rejects numbers Team Global Express does not issue and pre-aborted lookups without a request', async () => {
    const fetcher = vi.fn<typeof fetch>();
    for (const number of ['TG1', 'SAMPLETRACKING', `9${'0'.repeat(40)}`, '<script>1</script>']) {
      await expect(carrier(fetcher).track({ number })).rejects.toMatchObject({ kind: 'invalid_input' });
    }
    await expect(carrier(fetcher).track({ number: DELIVERED }, { signal: AbortSignal.abort(new Error('cancelled')) })).rejects.toThrow('cancelled');
    await expect(carrier(fetcher).track({ number: DELIVERED }, { budgetMs: 0 })).rejects.toMatchObject({ kind: 'budget' });
    expect(fetcher).not.toHaveBeenCalled();
    expect(normalizeTeamGlobalExpressNumber(' smpl 000-001 ')).toBe(IN_TRANSIT);
  });

  it('tries once more after a failed connection, inside the caller’s budget', async () => {
    const flaky = site(fixture('search-delivered'), fixture('details-delivered'));
    flaky.mockRejectedValueOnce(new TypeError('fetch failed'));
    await expect(carrier(flaky).track({ number: DELIVERED })).resolves.toMatchObject({ status: 'delivered' });
    expect(flaky).toHaveBeenCalledTimes(3);
    const slow = vi.fn<typeof fetch>((_input, init) => new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal!.reason), { once: true });
    }));
    const started = Date.now();
    await expect(carrier(slow).track({ number: DELIVERED }, { budgetMs: 60.5 }))
      .rejects.toMatchObject({ kind: expect.stringMatching(/^(?:transport|budget)$/) });
    expect(Date.now() - started).toBeLessThan(1000);
    expect(slow.mock.calls.length).toBeLessThanOrEqual(2);
    expect(slow.mock.calls.every(([, init]) => init?.signal?.aborted)).toBe(true);
  });

  it('routes a number filed under Team Global Express to the adapter, and leaves its shapes unclaimed', async () => {
    const fetcher = site(fixture('search-delivered'), fixture('details-delivered'));
    const tracker = createTracker({ fetcher, providers: [], env: {} });
    await expect(tracker.track({ number: DELIVERED, carrier: 'team-global-express' }, { budgetMs: 3000 }))
      .resolves.toMatchObject({ carrier: 'team-global-express', source: 'team-global-express', result: { current_stage: 'delivered' } });
    expect(fetcher.mock.calls.every(([url]) => String(url).startsWith('https://www.myteamge.com/'))).toBe(true);
    for (const number of [DELIVERED, IN_TRANSIT, '990000000017', '990000017']) expect(detectCarrierMatch(number).carrier).not.toBe('team-global-express');
  });
});

describe('Team Global Express status vocabulary', () => {
  it('maps every recorded code to the stage it records', () => {
    const entries = statuses.entries as { code?: string; wording: string; stage: string; confirmedBy: string }[];
    expect(entries.filter((entry) => entry.code && entry.confirmedBy === 'live').length).toBeGreaterThanOrEqual(25);
    for (const entry of entries.filter((row) => row.code)) {
      expect(statusMap.stage(entry.code!, entry.wording.toLowerCase()), entry.code).toBe(entry.stage);
      expect(statusMapAnswer({ carrier: 'team-global-express', providerCode: entry.code!, description: entry.wording }), entry.code)
        .toEqual({ kind: 'mapped', stage: entry.stage });
    }
    expect(statusMapAnswer({ carrier: 'team-global-express', providerCode: '81$$CL', description: 'Card Left' })).toEqual({ kind: 'unknown' });
    expect(teamGlobalExpressStage('90$$tcp', 'COLLCTD', '', 'Customer collected from Service Hub')).toEqual({ stage: 'delivered', source: 'carrier_map' });
    // An attempted delivery its exception names outranks the in-transit milestone.
    expect(teamGlobalExpressStage('', 'INTRNST', 'Attempted delivery', 'Closed / Not Home')).toEqual({ stage: 'failed_attempt', source: 'carrier_map' });
  });
});
