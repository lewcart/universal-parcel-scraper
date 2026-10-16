import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { statusMapAnswer } from '../../core/catalog/statusMaps.js';
import { detectCarrierMatch } from '../../core/detection/index.js';
import { normalizeStatusWording } from '../../core/status/statusMap.js';
import { NOOP_RECORDER } from '../../core/telemetry/index.js';
import { adapter, MayiyinfuTracker } from './adapter.js';
import { MAYIYINFU_ORIGIN, parseMayiyinfuPage, parseMayiyinfuTrack } from './parser.js';
import { statusMap } from './status.js';
import statuses from './statuses.json' with { type: 'json' };
import carrier from './carrier.json' with { type: 'json' };

const NUMBER = 'MY9900000001US';
const REFERENCE = 'REFTEST000001';
const UNKNOWN = 'MY9900000002US';
const READ_AT = Date.parse('2026-03-25T04:00:00Z');
const fixture = (name: string): unknown => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'));
const page = (name: string) => readFileSync(new URL(`./fixtures/${name}.html`, import.meta.url), 'utf8');
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
const html = (body: string) => new Response(body, { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
const environment = (fetcher: typeof fetch) => ({ fetcher, recorder: NOOP_RECORDER, env: {}, trawl: null, browserExecutablePath: null });
const track = (fetcher: typeof fetch, number = NUMBER) => adapter(environment(fetcher)).track({ number });

describe('Mayi Yinfu tracking adapter', () => {
  it('asks its own Hualei tracker for the whole number over plain HTTP', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json(fixture('track')));
    await expect(new MayiyinfuTracker({ fetcher, recorder: NOOP_RECORDER }).fetch('my 9900000001 us')).resolves.toMatchObject({ destination_country: 'ES' });
    const [url, init] = fetcher.mock.calls[0]!;
    expect(String(url)).toBe(`${MAYIYINFU_ORIGIN}/selectTrack.htm?documentCode=${NUMBER}`);
    expect(MAYIYINFU_ORIGIN).toBe('http://www.mayiyinfu.com.cn:8082');
    expect(init).toMatchObject({ method: 'GET', signal: expect.any(AbortSignal) });
    expect(adapter(environment(fetcher))).toMatchObject({ id: 'mayiyinfu', recordsSteps: true, steps: ['direct', 'retry'] });
  });

  it('reads a parcel in transit, with the rows DHL relays after the hand-off, as wall clocks', () => {
    const result = parseMayiyinfuTrack(fixture('track'), NUMBER, READ_AT)!;
    expect(result).toMatchObject({
      status: 'in_transit', current_stage: 'in_transit', current_stage_source: 'carrier_map', last_update: null,
      last_update_local: '2026-03-20T10:30:00', service_name: '合成专线-全球小包', destination_country: 'ES',
    });
    expect(result.last_status_text).toMatch(/^The shipment has arrived in the destination country\/destination area\. \(Homepage/);
    expect(result.events).toHaveLength(22);
    expect(result.events!.every((event) => event.local_time && !event.time && event.stage)).toBe(true);
    expect(result.events!.slice(1, 3)).toEqual([
      { local_time: '2026-03-18T14:12:00', description: 'The international shipment has been processed in the export parcel center', location: 'DE', stage: 'in_transit', stage_source: 'carrier_map' },
      { local_time: '2026-03-17T11:47:00', description: 'The international shipment has been processed in the parcel center of origin', location: 'DE', stage: 'in_transit', stage_source: 'carrier_map' },
    ]);
    expect(result.events!.find((event) => event.provider_code === 'ARRIVAL')).toEqual({
      local_time: '2026-03-04T22:51:19', description: '已入库,到达收货点', location: 'SAMPLECITY', provider_code: 'ARRIVAL', stage: 'accepted', stage_source: 'carrier_map',
    });
    // The airport rows' translation reads "delivered"; the step they lead with is a hand-over to the airport.
    const airport = result.events!.filter((event) => event.description!.startsWith('货物已交机场'));
    expect(airport.map((event) => [event.stage, event.stage_source])).toEqual([['in_transit', 'carrier_map'], ['in_transit', 'carrier_map']]);
    expect(result.events!.at(-1)).toMatchObject({ stage: 'registered', stage_source: 'carrier_map' });
    // The record names no channel: a transfer number DHL's rule fits hands nothing over.
    expect(detectCarrierMatch('CJ000000005DE').carrier).toBe('dhl');
    expect(result).not.toHaveProperty('delivery_carrier');
    expect(result).not.toHaveProperty('delivery_tracking_number');
    expect(result).not.toHaveProperty('canonical_tracking_number');
    expect(JSON.stringify(result)).not.toMatch(/Synthetic (?:Recipient|Shipper)|Sintética|00000"|1\.2/);
    // Asked by the shipper's reference, the order's own number comes back.
    expect(parseMayiyinfuTrack(fixture('track'), REFERENCE, READ_AT)!.canonical_tracking_number).toBe(NUMBER);
  });

  it('reads the delivery DHL relays', async () => {
    const result = await track(vi.fn<typeof fetch>().mockResolvedValue(json(fixture('track-delivered'))));
    expect(result).toMatchObject({ status: 'delivered', current_stage: 'delivered', last_status_text: 'The shipment has been delivered', last_update_local: '2026-03-23T12:15:00' });
    expect(result.events![0]).toMatchObject({ location: 'ES', stage: 'delivered', stage_source: expect.stringMatching(/^wording:/) });
  });

  it('reads only the page that echoes the number as not found', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json(fixture('no-track'))).mockResolvedValueOnce(html(page('page-unknown')));
    await expect(track(fetcher, UNKNOWN)).rejects.toMatchObject({ kind: 'not_found' });
    expect(fetcher.mock.calls.map(([url, init]) => [String(url), init?.method])).toEqual([
      [`${MAYIYINFU_ORIGIN}/selectTrack.htm?documentCode=${UNKNOWN}`, 'GET'],
      [`${MAYIYINFU_ORIGIN}/trackIndex.htm`, 'POST'],
    ]);
    expect(String(fetcher.mock.calls[1]![1]!.body)).toBe(`documentCode=${UNKNOWN}`);
    expect(parseMayiyinfuTrack(fixture('no-track'), UNKNOWN, READ_AT)).toBeNull();
    expect(() => parseMayiyinfuPage(page('page-unknown'), NUMBER, READ_AT)).toThrow(expect.objectContaining({ kind: 'indeterminate' }));
  });

  it('keeps blocks, rate limits, changed replies, other shipments and foreign numbers apart from not-found', async () => {
    await expect(track(vi.fn<typeof fetch>().mockResolvedValue(html('<html><head><title>Just a moment...</title></head></html>')))).rejects.toMatchObject({ kind: 'challenge' });
    await expect(track(vi.fn<typeof fetch>().mockResolvedValue(json({}, 429)))).rejects.toMatchObject({ kind: 'rate_limited' });
    await expect(track(vi.fn<typeof fetch>().mockResolvedValue(html('<html><body>Service Unavailable</body></html>')))).rejects.toMatchObject({ kind: 'schema' });
    await expect(track(vi.fn<typeof fetch>().mockResolvedValue(json({ ack: 'true' })))).rejects.toMatchObject({ kind: 'schema' });
    // A record whose own numbers do not include the one asked is no answer for it.
    await expect(track(vi.fn<typeof fetch>().mockResolvedValue(json(fixture('track'))), UNKNOWN)).rejects.toMatchObject({ kind: 'indeterminate' });
    const unsent = vi.fn<typeof fetch>();
    await expect(track(unsent, 'MY,9900000001')).rejects.toMatchObject({ kind: 'invalid_input' });
    expect(unsent).not.toHaveBeenCalled();
  });

  it('maps every wording it lists, the steps whatever follows them, and the app reads the map', () => {
    for (const entry of statuses.entries) expect(statusMap.stage(null, normalizeStatusWording(entry.wording)), entry.wording).toBe(entry.stage);
    const answer = (description: string) => statusMapAnswer({ carrier: 'mayiyinfu', providerCode: null, description });
    expect(answer('货物已交机场，预计21号的航班The goods have been delivered to the airport. The flight is scheduled for the 21st.')).toEqual({ kind: 'mapped', stage: 'in_transit' });
    expect(answer('The shipment has arrived in the destination country/destination area. (Homepage / online shipment tracking: https://example.test/?id=1)'))
      .toEqual({ kind: 'mapped', stage: 'in_transit' });
    expect(answer('合成的记录')).toEqual({ kind: 'unknown' });
    expect(carrier.portal).not.toHaveProperty('url');
    expect(carrier.portal).not.toHaveProperty('searchUrl');
    expect(detectCarrierMatch(NUMBER)).toMatchObject({ carrier: 'mayiyinfu', confidence: 'high' });
  });
});
