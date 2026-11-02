import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { statusMapAnswer } from '../../core/catalog/statusMaps.js';
import { detectCarrierMatch } from '../../core/detection/index.js';
import { NOOP_RECORDER } from '../../core/telemetry/index.js';
import { delayedFetcher } from '../../core/testing/hang.js';
import { fakeBudgetClock } from '../../testing/budgetClock.js';
import { createTracker } from '../../facade/index.js';
import { adapter, TNT_AUSTRALIA_HISTORY, TntAustraliaTracker, tntAustraliaLookupUrl } from './adapter.js';
import { normalizeTntAustraliaNumber, parseTntAustralia } from './parser.js';
import { statusMap, tntAustraliaMappedStage, tntAustraliaStage } from './status.js';
import statuses from './statuses.json' with { type: 'json' };

const DELIVERED = 'ZZZ000000001';
const IN_TRANSIT = 'ZZZ000000002';
const UNKNOWN = 'ZZZ000000009';

const text = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const html = (body: string, init: ResponseInit = {}) => new Response(body, { ...init, headers: { 'Content-Type': 'text/html', ...init.headers } });
const carrier = (fetcher: typeof fetch) => adapter({ fetcher, recorder: NOOP_RECORDER, env: {}, trawl: null, browserExecutablePath: null });
const replying = (response: () => Response) => vi.fn<typeof fetch>().mockImplementation(async () => response());
const CLOUDFLARE = '<html><head><title>Just a moment...</title></head><script>window._cf_chl_opt={}</script></html>';

describe('TNT Australia HTTP adapter', () => {
  it('opens the consignment history page with the number', async () => {
    const fetcher = replying(() => html(text('in-transit.html')));
    const recorder = { ...NOOP_RECORDER, step: vi.fn(), lookup: vi.fn() };
    await expect(new TntAustraliaTracker({ fetcher, recorder, userAgent: 'SyntheticHost/1.0' }).fetch(' zzz 000-000-002 ', { budgetMs: 1000.5 }))
      .resolves.toMatchObject({ status: 'in_transit' });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${TNT_AUSTRALIA_HISTORY}?con=${IN_TRANSIT}`);
    expect(url).toBe(tntAustraliaLookupUrl(IN_TRANSIT));
    expect(init).toMatchObject({ method: 'GET', redirect: 'manual', signal: expect.any(AbortSignal), headers: { 'User-Agent': 'SyntheticHost/1.0' } });
    expect(recorder.step).toHaveBeenCalledWith(expect.objectContaining({ carrier: 'tnt-au', step: 'direct', outcome: 'ok' }));
    expect(recorder.lookup).toHaveBeenCalledTimes(1);
  });

  it('reads a delivered history newest first, as the depots’ wall clocks, without a booking note’s stage or the estimate', () => {
    const result = parseTntAustralia(text('delivered.html'), DELIVERED);
    expect(result).toMatchObject({ status: 'delivered', current_stage: 'delivered', current_stage_source: 'carrier_map',
      last_status_text: 'Book-In Delivery Arranged', last_update: null, last_update_local: '2026-04-14T16:59:00', expected_delivery: null });
    expect(result.events!.map((event) => [event.local_time, event.description, event.location, event.stage])).toEqual([
      ['2026-04-14T16:59:00', 'Book-In Delivery Arranged', 'Exampleville', undefined],
      ['2026-04-14T11:04:00', "We've delivered your shipment", 'Exampleville', 'delivered'],
      ['2026-04-14T09:18:00', "Your shipment's with a driver", 'Exampleville', 'out_for_delivery'],
      ['2026-04-13T17:20:00', 'Book-In Delivery Requested', 'Exampleville', undefined],
      ['2026-04-13T17:05:00', 'Delivery returned to depot', 'Exampleville', 'failed_attempt'],
      ['2026-04-13T11:42:00', 'Delivery attempted - card left', 'Exampleville', 'failed_attempt'],
      ['2026-04-13T08:10:00', "Your shipment's with a driver", 'Exampleville', 'out_for_delivery'],
      ['2026-04-13T06:56:00', "We're processing your shipment", 'Exampleville', 'in_transit'],
      ['2026-04-09T17:51:00', 'Your shipment is in transit', 'Sampleton - Westpark', 'in_transit'],
      ['2026-04-09T17:35:00', "We're processing your shipment", 'Sampleton - Westpark', 'in_transit'],
      ['2026-04-09T15:02:00', "We've collected your shipment", 'Sampleton - Westpark', 'accepted'],
      ['2026-04-09T14:19:00', 'Your shipment data is lodged', 'Sampleton - Westpark', 'registered'],
    ]);
    expect(result.events!.every((event) => !('time' in event) && (!event.stage || event.stage_source === 'carrier_map'))).toBe(true);
  });

  it('keeps the estimate’s day, a scan given by its day alone, an unknown wording and a scan without a depot', () => {
    const result = parseTntAustralia(text('in-transit.html'), IN_TRANSIT);
    expect(result).toMatchObject({ status: 'in_transit', current_stage: 'in_transit', last_status_text: "We're processing your shipment",
      last_update_local: '2026-02-02T06:20:00', expected_delivery: '2026-02-03' });
    expect(result.events).toEqual([
      { local_time: '2026-02-02T06:20:00', description: "We're processing your shipment", stage: 'in_transit', stage_source: 'carrier_map' },
      { local_time: '2026-01-31T07:29:00', location: 'Sample & Example Airport', description: 'Sample wording' },
      { local_time: '2026-01-30', location: 'Sampleton - Westpark', description: "We're processing your shipment", stage: 'in_transit', stage_source: 'carrier_map' },
      { local_time: '2026-01-30T11:34:00', location: 'Sampleton - Westpark', description: "We've collected your shipment", stage: 'accepted', stage_source: 'carrier_map' },
      { local_time: '2026-01-30T11:14:00', location: 'Sampleton - Westpark', description: 'Your shipment data is lodged', stage: 'registered', stage_source: 'carrier_map' },
    ]);
    for (const estimate of ['31/02/2026 17:00', 'Sample', '2026-02-03']) {
      const page = text('in-transit.html').replace('Estimated Delivery by: 3/02/2026 17:00', `Estimated Delivery by: ${estimate}`);
      expect(parseTntAustralia(page, IN_TRANSIT), estimate).toMatchObject({ expected_delivery: null });
    }
    expect(parseTntAustralia(text('in-transit.html').replace(/<td class='strong'>Estimated[^<]*<\/td>/, ''), IN_TRANSIT))
      .toMatchObject({ expected_delivery: null });
  });

  it('reads “No consignment was found” as not found', async () => {
    expect(() => parseTntAustralia(text('not-found.html'), UNKNOWN)).toThrow(expect.objectContaining({ kind: 'not_found' }));
    await expect(carrier(replying(() => html(text('not-found.html')))).track({ number: UNKNOWN })).rejects.toMatchObject({ kind: 'not_found' });
    // Another notice in its place is not the tracker's answer.
    expect(() => parseTntAustralia(text('not-found.html').replace('No consignment was found', 'Please try again later'), UNKNOWN))
      .toThrow(expect.objectContaining({ kind: 'schema' }));
  });

  it('has no history for a consignment whose table holds no scan', () => {
    const empty = text('delivered.html').replace(/Depot<\/td><\/tr>[\s\S]*?<\/table><br>/, 'Depot</td></tr>\t</table><br>');
    expect(() => parseTntAustralia(empty, DELIVERED)).toThrow(expect.objectContaining({ kind: 'indeterminate', name: 'NoHistoryError' }));
  });

  it('keeps only a page that names the whole number asked', () => {
    expect(() => parseTntAustralia(text('delivered.html'), IN_TRANSIT))
      .toThrow(expect.objectContaining({ kind: 'indeterminate', message: 'TNT Australia answered for another consignment' }));
    expect(() => parseTntAustralia(text('not-found.html'), DELIVERED))
      .toThrow(expect.objectContaining({ kind: 'indeterminate', message: 'TNT Australia answered for another consignment' }));
    expect(() => parseTntAustralia(text('delivered.html').replace(`Consignment No: ${DELIVERED}`, 'Consignment No: '), DELIVERED))
      .toThrow(expect.objectContaining({ kind: 'schema', message: 'TNT Australia did not name the consignment' }));
    expect(parseTntAustralia(text('delivered.html').replace(`Consignment No: ${DELIVERED}`, `Consignment No: ${DELIVERED.toLowerCase()}`), DELIVERED))
      .toMatchObject({ current_stage: 'delivered' });
  });

  it('rejects a changed page', () => {
    const page = text('delivered.html');
    for (const [index, body] of [
      '',
      '<html><body><main>Sample maintenance page</main></body></html>',
      page.replace('<h4>Consignment Status History</h4>', '<h4>Track a Package</h4>'),
      page.replace('id="appTable"', 'id="historyTable"'),
      page.replace('<td class=heading width="60">Time</td>', '<td class=heading width="60">Clock</td>'),
      page.replace('\t\t<td>09/04/2026</td>\t\t<td>14:19</td>', '\t\t<td>09/04/2026 14:19</td>'),
      page.replace('<td>Your shipment data is lodged</td>', '<td> </td>'),
      page.replace('<td>09/04/2026</td>\t\t<td>14:19</td>', '<td>2026-04-09</td>\t\t<td>14:19</td>'),
      page.replace('<td>09/04/2026</td>\t\t<td>14:19</td>', '<td>31/04/2026</td>\t\t<td>14:19</td>'),
      page.replace('<td>09/04/2026</td>\t\t<td>14:19</td>', '<td>09/04/2026</td>\t\t<td>24:19</td>'),
      page.replace('<td>09/04/2026</td>\t\t<td>14:19</td>', '<td>09/04/2026</td>\t\t<td>2:19 PM</td>'),
      page.replace('</td></tr>\t<tr>', `</td></tr>${'\t<tr><td>Sample</td><td>09/04/2026</td><td>14:19</td><td>X</td></tr>'.repeat(301)}\t<tr>`),
    ].entries()) {
      expect(() => parseTntAustralia(body, DELIVERED), String(index)).toThrow(expect.objectContaining({ kind: 'schema' }));
    }
  });

  it('keeps a browser check, a refusal, a moved route and a broken page apart from an unknown number', async () => {
    const lookup = (response: () => Response) => carrier(replying(response)).track({ number: DELIVERED });
    await expect(lookup(() => html(CLOUDFLARE))).rejects.toMatchObject({ kind: 'challenge' });
    await expect(lookup(() => html(CLOUDFLARE, { status: 403 }))).rejects.toMatchObject({ kind: 'challenge', status: 403 });
    await expect(lookup(() => html('', { status: 404 }))).rejects.toMatchObject({ kind: 'transport', status: 404 });
    await expect(lookup(() => html('', { status: 302, headers: { Location: 'https://www.tntexpress.com.au/' } })))
      .rejects.toMatchObject({ kind: 'transport', status: 302 });
    await expect(lookup(() => html('<html><body>Sample maintenance page</body></html>'))).rejects.toMatchObject({ kind: 'schema' });
  });

  it.each([[429, 'rate_limited'], [500, 'indeterminate'], [503, 'maintenance']] as const)(
    'preserves HTTP %s as %s during retrieval and recognition', async (status, kind) => {
      const fetcher = replying(() => new Response('', { status }));
      await expect(carrier(fetcher).track({ number: DELIVERED })).rejects.toMatchObject({ kind });
      await expect(carrier(fetcher).recognize!(DELIVERED)).rejects.toMatchObject({ kind });
    });

  it('refuses what the carrier does not issue, or a cancelled lookup, without a request', async () => {
    const fetcher = vi.fn<typeof fetch>();
    for (const number of ['ZZ000000001', 'ZZZZ00000001', 'ZZZ00000001', 'ZZZ0000000001', 'ZZZ00000000', '000000000001', 'ZZZ000000001,ZZZ000000002',
      'ZZZ000000001?', '0'.repeat(65)]) {
      await expect(carrier(fetcher).track({ number }), number).rejects.toMatchObject({ kind: 'invalid_input' });
    }
    await expect(carrier(fetcher).track({ number: DELIVERED }, { signal: AbortSignal.abort(new Error('cancelled')) })).rejects.toThrow('cancelled');
    expect(fetcher).not.toHaveBeenCalled();
    expect(normalizeTntAustraliaNumber(' zzz-000 000 001 ')).toBe(DELIVERED);
    // Older consignments have seven digits.
    expect(normalizeTntAustraliaNumber('ZZZ0000001')).toBe('ZZZ0000001');
  });

  it('tries a read that hangs once more, inside the budget', async () => {
    fakeBudgetClock();
    const { fetcher, ended } = delayedFetcher([{ afterMs: Infinity }, { afterMs: Infinity }]);
    const spent = expect(carrier(fetcher).track({ number: DELIVERED }, { budgetMs: 120 })).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(120);
    await spent;
    expect(fetcher).toHaveBeenCalledTimes(2);
    // Half of the budget, then the retry until it ends.
    expect(ended).toEqual([60, 120]);
  });

  it('recognizes a known consignment and the unknown-number answer, and asks nothing for a number TNT Australia does not issue', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(html(text('delivered.html'))).mockResolvedValueOnce(html(text('not-found.html')));
    await expect(carrier(fetcher).recognize!(DELIVERED)).resolves.toEqual({ known: true, lastActivityAt: null, lastActivityLocal: '2026-04-14T16:59:00' });
    await expect(carrier(fetcher).recognize!(UNKNOWN)).resolves.toEqual({ known: false });
    await expect(carrier(fetcher).recognize!('ZZ000000001')).resolves.toEqual({ known: false });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('names an APK consignment outright, and leaves other lettered consignments to Purolator unless filed under TNT Australia', async () => {
    const APK = 'APK000000001';
    for (const number of [APK, 'APK0000001']) expect(detectCarrierMatch(number), number).toMatchObject({ carrier: 'tnt-au', confidence: 'high' });
    expect(detectCarrierMatch(DELIVERED)).toMatchObject({ carrier: 'purolator', confidence: 'high' });
    const page = (number: string) => text('delivered.html').replaceAll(DELIVERED, number);
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (url) => html(page(new URL(String(url)).searchParams.get('con')!)));
    const tracker = createTracker({ fetcher, providers: [], env: {} });
    await expect(tracker.track({ number: APK }, { budgetMs: 3000 }))
      .resolves.toMatchObject({ carrier: 'tnt-au', source: 'tnt-au', result: { current_stage: 'delivered' } });
    await expect(tracker.track({ number: DELIVERED, carrier: 'tnt-au' }, { budgetMs: 3000 }))
      .resolves.toMatchObject({ carrier: 'tnt-au', source: 'tnt-au', result: { current_stage: 'delivered' } });
    expect(fetcher.mock.calls.map(([url]) => String(url))).toEqual([tntAustraliaLookupUrl(APK), tntAustraliaLookupUrl(DELIVERED)]);
  });
});

describe('TNT Australia status vocabulary', () => {
  it('records every wording the map knows with the stage it gives, and leaves the booking notes without one', () => {
    for (const entry of statuses.entries as { wording: string; stage?: string; unmapped?: boolean }[]) {
      if (entry.unmapped) {
        expect(tntAustraliaStage(entry.wording), entry.wording).toBeNull();
        expect(statusMapAnswer({ carrier: 'tnt-au', description: entry.wording }), entry.wording).toMatchObject({ kind: 'intentional_gap' });
        continue;
      }
      expect(statusMapAnswer({ carrier: 'tnt-au', description: entry.wording }), entry.wording).toEqual({ kind: 'mapped', stage: entry.stage });
      expect(tntAustraliaStage(entry.wording), entry.wording).toEqual({ stage: entry.stage, source: 'carrier_map' });
    }
  });

  it('leaves another wording to the shared rules', () => {
    expect(tntAustraliaMappedStage('Out for delivery')).toBeUndefined();
    expect(tntAustraliaStage('Out for delivery')).toEqual({ stage: 'out_for_delivery', source: 'wording:language' });
    expect(tntAustraliaStage('Sample wording')).toBeNull();
    expect(statusMap.stage(null, "we've delivered your shipment")).toBe('delivered');
    expect(statusMap.stage('X', "we've delivered your shipment")).toBeUndefined();
    expect(statusMapAnswer({ carrier: 'tnt-au', description: 'Sample wording' })).toEqual({ kind: 'unknown' });
  });
});
