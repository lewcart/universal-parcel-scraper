import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { statusMapAnswer } from '../../core/catalog/statusMaps.js';
import { normalizeStatusWording } from '../../core/status/statusMap.js';
import { NOOP_RECORDER } from '../../core/telemetry/index.js';
import { adapter, ThhyTracker } from './adapter.js';
import { parseThhyPage, parseThhyTrack, THHY_ORIGIN } from './parser.js';
import { statusMap } from './status.js';
import statuses from './statuses.json' with { type: 'json' };
import carrier from './carrier.json' with { type: 'json' };

const NUMBER = 'THTEST00000002';
// Noon in Beijing on 6 March: the fixture's last row, dated the next evening, is still ahead.
const READ_AT = Date.parse('2026-03-06T04:00:00Z');
const fixture = (name: string): unknown => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'));
const page = (name: string) => readFileSync(new URL(`./fixtures/${name}.html`, import.meta.url), 'utf8');
const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
const html = (body: string) => new Response(body, { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
const environment = (fetcher: typeof fetch) => ({ fetcher, recorder: NOOP_RECORDER, env: {}, trawl: null, browserExecutablePath: null });

describe('Tianhui Hengyuan tracking adapter', () => {
  it('asks its own Hualei tracker for the whole number over plain HTTP', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json(fixture('track')));
    await expect(new ThhyTracker({ fetcher, recorder: NOOP_RECORDER }).fetch('th-test-002')).resolves.toMatchObject({ canonical_tracking_number: NUMBER });
    const [url, init] = fetcher.mock.calls[0]!;
    expect(String(url)).toBe(`${THHY_ORIGIN}/selectTrack.htm?documentCode=TH-TEST-002`);
    expect(THHY_ORIGIN).toBe('http://134.175.221.174:8082');
    expect(init).toMatchObject({ method: 'GET', signal: expect.any(AbortSignal) });
    expect(adapter(environment(fetcher))).toMatchObject({ id: 'thhy', recordsSteps: true, steps: ['direct', 'retry'] });
  });

  it('reads the timeline its custom track product writes, holding back the rows still ahead', () => {
    const result = parseThhyTrack(fixture('track'), NUMBER, READ_AT)!;
    expect(result).toMatchObject({
      status: 'in_transit', current_stage: 'in_transit', current_stage_source: 'carrier_map', last_status_text: '正在发往操作中心',
      last_update: '2026-03-05T16:30:57+08:00', service_name: 'Synthetic Track A', destination_country: 'CH',
    });
    expect(result.canonical_tracking_number).toBeUndefined();
    expect(result.events!.map((event) => event.time)).not.toContain('2026-03-07T20:48:57+08:00');
    expect(result.events!.slice(0, 3)).toEqual([
      { time: '2026-03-05T16:30:57+08:00', description: '正在发往操作中心', location: '下一站', provider_code: 'CO_C_CR', stage: 'in_transit', stage_source: 'carrier_map' },
      { time: '2026-03-05T10:54:57+08:00', description: '放行', location: '海关出口', provider_code: 'CO_C_CR', stage: 'in_transit', stage_source: 'carrier_map' },
      { time: '2026-03-05T06:30:57+08:00', description: '送交出口', location: '海关', provider_code: 'CO_C_CR', stage: 'customs', stage_source: 'carrier_map' },
    ]);
    expect(result.events!.slice(-2)).toEqual([
      { time: '2026-03-02T16:30:57+08:00', description: '货物离开操作中心', location: 'GZ', provider_code: 'SHIPMENT', stage: 'in_transit', stage_source: 'carrier_map' },
      { time: '2026-03-02T16:15:01+08:00', description: 'Arrived at the receiving point', location: 'GZ', provider_code: 'ARRIVAL', stage: 'accepted', stage_source: 'carrier_map' },
    ]);
    expect(result.events!.every((event) => event.stage)).toBe(true);
  });

  it('reads the page’s unknown-number answer as not found', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json(fixture('no-track'))).mockResolvedValueOnce(html(page('page-unknown')));
    await expect(adapter(environment(fetcher)).track({ number: 'NOTFOUND000002' })).rejects.toMatchObject({ kind: 'not_found' });
    expect(String(fetcher.mock.calls[1]![0])).toBe(`${THHY_ORIGIN}/trackIndex.htm`);
    expect(() => parseThhyPage(page('page-unknown'), 'NOTFOUND000002', READ_AT)).toThrow('could not locate');
    const unknown = vi.fn<typeof fetch>().mockResolvedValueOnce(json(fixture('no-track'))).mockResolvedValueOnce(html(page('page-unknown')));
    await expect(adapter(environment(unknown)).recognize!('NOTFOUND000002')).resolves.toEqual({ known: false });
  });

  it('maps every wording it lists by wording alone, and the app reads the map', () => {
    for (const entry of statuses.entries) expect(statusMap.stage(null, normalizeStatusWording(entry.wording)), entry.wording).toBe(entry.stage);
    expect(statusMapAnswer({ carrier: 'thhy', providerCode: 'CO_C_CR', description: '送交出口' })).toEqual({ kind: 'mapped', stage: 'customs' });
    expect(statusMapAnswer({ carrier: 'thhy', providerCode: 'CO_C_CR', description: '送交境外进口海关' })).toEqual({ kind: 'mapped', stage: 'customs' });
    expect(statusMapAnswer({ carrier: 'thhy', providerCode: 'CO_C_CR', description: 'Packages ready for delivery on the next working day' }))
      .toEqual({ kind: 'mapped', stage: 'in_transit' });
    expect(statusMapAnswer({ carrier: 'thhy', providerCode: 'CO_C_CR', description: '合成的记录' })).toEqual({ kind: 'unknown' });
    expect(carrier.portal).not.toHaveProperty('url');
  });
});
