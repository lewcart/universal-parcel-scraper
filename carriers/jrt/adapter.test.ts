import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { statusMapAnswer } from '../../core/catalog/statusMaps.js';
import { NOOP_RECORDER } from '../../core/telemetry/index.js';
import { adapter } from './adapter.js';
import { JRT_ORIGIN, parseJrtPage, parseJrtTrack } from './parser.js';
import carrier from './carrier.json' with { type: 'json' };

const REFERENCE = 'REFTEST000003';
const READ_AT = Date.parse('2026-03-06T04:00:00Z');
const fixture = (name: string): unknown => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'));
const page = (name: string) => readFileSync(new URL(`./fixtures/${name}.html`, import.meta.url), 'utf8');
const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
const html = (body: string) => new Response(body, { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
const environment = (fetcher: typeof fetch) => ({ fetcher, recorder: NOOP_RECORDER, env: {}, trawl: null, browserExecutablePath: null });

describe('JRT tracking adapter', () => {
  it('finds an order without scans by the shipper’s reference on the page, after the interface has no row', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json(fixture('no-track'))).mockResolvedValueOnce(html(page('page-registered')));
    const result = await adapter(environment(fetcher)).track({ number: REFERENCE });
    expect(result).toMatchObject({
      status: 'pending', current_stage: 'registered', current_stage_source: 'carrier_map', last_status_text: '货物电子信息已经收到',
      last_update: '2026-03-02T14:34:18+08:00', destination_country: 'CH', canonical_tracking_number: 'JRT0000000000ZZ',
    });
    expect(result.events).toEqual([
      { time: '2026-03-02T14:34:18+08:00', description: '货物电子信息已经收到', stage: 'registered', stage_source: 'carrier_map' },
    ]);
    expect(JSON.stringify(result)).not.toContain('Synthetic Recipient');
    expect(fetcher.mock.calls.map(([url, init]) => [String(url), init?.method])).toEqual([
      [`${JRT_ORIGIN}/selectTrack.htm?documentCode=${REFERENCE}`, 'GET'],
      [`${JRT_ORIGIN}/trackIndex.htm`, 'POST'],
    ]);
    expect(JRT_ORIGIN).toBe('http://106.53.64.22:8082');
    expect(String(fetcher.mock.calls[1]![1]!.body)).toBe(`documentCode=${REFERENCE}`);
  });

  it('reads JRT’s own number on the same page, and an unknown number as not found', async () => {
    expect(parseJrtPage(page('page-registered'), 'JRT0000000000ZZ', READ_AT).canonical_tracking_number).toBeUndefined();
    expect(parseJrtTrack(fixture('no-track'), 'JRT0000000000ZZ', READ_AT)).toBeNull();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json(fixture('no-track'))).mockResolvedValueOnce(html(page('page-unknown')));
    await expect(adapter(environment(fetcher)).track({ number: 'NOTFOUND000003' })).rejects.toMatchObject({ kind: 'not_found' });
  });

  it('maps the platform’s own row, and links no plain-HTTP page', () => {
    expect(statusMapAnswer({ carrier: 'jrt', providerCode: null, description: '货物电子信息已经收到' })).toEqual({ kind: 'mapped', stage: 'registered' });
    expect(adapter(environment(vi.fn<typeof fetch>()))).toMatchObject({ id: 'jrt', recordsSteps: true, steps: ['direct', 'retry'] });
    expect(carrier.portal).not.toHaveProperty('url');
    expect(carrier.portal).not.toHaveProperty('searchUrl');
  });
});
