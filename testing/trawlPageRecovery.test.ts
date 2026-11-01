import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { AdapterFactory } from '../core/adapter/index.js';
import { NOOP_RECORDER } from '../core/telemetry/index.js';
import { TrawlClient } from '../core/transport/trawl.js';
import { adapter as proCarrier } from '../carriers/pro-carrier/adapter.js';
import { adapter as delnext } from '../carriers/delnext/adapter.js';
import { adapter as mrl } from '../carriers/mrl-global/adapter.js';
import { adapter as ait } from '../carriers/ait-worldwide/adapter.js';
import { adapter as hitch } from '../carriers/hitch/adapter.js';
import { adapter as pbt } from '../carriers/pbt/adapter.js';
import { adapter as celeritas } from '../carriers/celeritas/adapter.js';
import { adapter as dpdPt } from '../carriers/dpd-pt/adapter.js';
import { adapter as fleetoptics } from '../carriers/fleetoptics/adapter.js';
import { adapter as horoz } from '../carriers/horoz/adapter.js';
import { adapter as ocasa } from '../carriers/ocasa/adapter.js';
import { adapter as speedex } from '../carriers/speedex/adapter.js';
import { adapter as whistl } from '../carriers/whistl/adapter.js';
import { adapter as citymail } from '../carriers/citymail/adapter.js';
import { DPD_PT_MAX_BYTES } from '../carriers/dpd-pt/parser.js';
import { FLEETOPTICS_MAX_BYTES } from '../carriers/fleetoptics/parser.js';
import { HOROZ_MAX_BYTES } from '../carriers/horoz/parser.js';
import { OCASA_MAX_BYTES } from '../carriers/ocasa/parser.js';
import { SPEEDEX_MAX_BYTES } from '../carriers/speedex/parser.js';
import { WHISTL_MAX_BYTES } from '../carriers/whistl/parser.js';
import { CITYMAIL_MAX_BYTES } from '../carriers/citymail/parser.js';

const SERVICE = 'https://browser.test/scrape';
const BLOCK = '<html><title>Just a moment...</title><script>window._cf_chl_opt={}</script></html>';
const pageCaps: Record<string, number> = { 'dpd-pt': DPD_PT_MAX_BYTES, fleetoptics: FLEETOPTICS_MAX_BYTES,
  horoz: HOROZ_MAX_BYTES, ocasa: OCASA_MAX_BYTES, speedex: SPEEDEX_MAX_BYTES, whistl: WHISTL_MAX_BYTES, citymail: CITYMAIL_MAX_BYTES };
const subjects: [string, AdapterFactory, string, string][] = [
  ['pro-carrier', proCarrier, 'DG00000000001', 'delivered'],
  ['delnext', delnext, 'DNX4T7', 'delivered'],
  ['mrl-global', mrl, 'CAAA000001', 'delivered'],
  ['ait-worldwide', ait, '555000111', 'delivered'],
  ['hitch', hitch, 'ZIP0SYNTHETIC01', 'delivered'],
  ['pbt', pbt, 'ZZD00000002', 'delivered'],
  ['celeritas', celeritas, '912345670', 'transit'],
  ['dpd-pt', dpdPt, '09990000000101', 'delivered'],
  ['fleetoptics', fleetoptics, 'FOAESH1234567', 'delivered'],
  ['horoz', horoz, '12340678901234', 'delivered'],
  ['ocasa', ocasa, '40000000017', 'delivered'],
  ['speedex', speedex, '700000000017', 'delivered'],
  ['whistl', whistl, 'WHI0000GB00000000123', 'own'],
  ['citymail', citymail, 'BCMXY900000001', 'delivered'],
];

function harness(subject: typeof subjects[number], direct: () => Response, change: (page: Record<string, unknown>) => void = () => {}) {
  const [id, factory, number, fixture] = subject;
  const html = readFileSync(new URL(`../carriers/${id}/fixtures/${fixture}.html`, import.meta.url), 'utf8');
  const requests: Record<string, unknown>[] = [];
  const urls: string[] = [];
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (url, init) => {
    urls.push(String(url));
    if (String(url) !== SERVICE) return direct();
    const request = JSON.parse(String(init?.body)) as Record<string, unknown>;
    requests.push(request);
    const page = { url: request.url, html, statusCode: 200, tier: 3 };
    change(page);
    return Response.json(page);
  });
  const recorder = { ...NOOP_RECORDER, step: vi.fn(), lookup: vi.fn() };
  const adapter = factory({ fetcher, trawl: new TrawlClient(SERVICE), recorder, env: {}, browserExecutablePath: null });
  return { adapter, requests, urls, recorder, number, html };
}

describe.each(subjects)('%s browser recovery', (id, factory, number, fixture) => {
  const subject: typeof subjects[number] = [id, factory, number, fixture];

  it('recovers the whole history after a 403, with the original failure recorded', async () => {
    const h = harness(subject, () => new Response(BLOCK, { status: 403 }));
    const result = await h.adapter.track({ number });
    expect(result.events!.length).toBeGreaterThan(0);
    const direct = harness(subject, () => new Response(h.html));
    expect(result).toEqual(await direct.adapter.track({ number }));
    expect(direct.requests).toHaveLength(0);
    expect(h.requests).toEqual([expect.objectContaining({ url: h.urls[0], skipHttp: true, maxTier: 3 })]);
    expect(Number(h.requests[0]!.maxTimeout)).toBeGreaterThan(0);
    expect(Number(h.requests[0]!.maxTimeout)).toBeLessThanOrEqual(30_000);
    expect(h.recorder.step.mock.calls.map(([step]) => [step.step, step.outcome, step.fallbackFrom]))
      .toEqual([['direct', 'challenge', null], ['trawl', 'ok', 'direct']]);
    expect(h.recorder.lookup).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'ok', attempts: 2, finalStep: 'trawl' }));
  });

  it('recovers an HTTP 200 challenge too', async () => {
    const h = harness(subject, () => new Response(BLOCK));
    await expect(h.adapter.track({ number })).resolves.toHaveProperty('events');
    expect(h.requests).toHaveLength(1);
  });

  it('does not open a browser after a rate limit', async () => {
    const h = harness(subject, () => new Response('slow down', { status: 429, headers: { 'Retry-After': '60' } }));
    await expect(h.adapter.track({ number })).rejects.toMatchObject({ status: 429 });
    expect(h.requests).toHaveLength(0);
  });

  it('does not open a browser for a changed tracking page', async () => {
    const h = harness(subject, () => new Response('<html><title>Tracking</title><body>Unexpected page</body></html>'));
    await expect(h.adapter.track({ number })).rejects.toBeInstanceOf(Error);
    expect(h.requests).toHaveLength(0);
  });

  if (pageCaps[id]) it('rejects an otherwise valid remote page that exceeds the carrier’s own limit', async () => {
    const h = harness(subject, () => new Response(BLOCK, { status: 403 }), page => {
      page.html = `${String(page.html)}<!--${'x'.repeat(pageCaps[id]! + 1)}-->`;
    });
    await expect(h.adapter.track({ number })).rejects.toMatchObject({ kind: 'schema' });
    expect(h.requests).toHaveLength(1);
  });

  it('passes cancellation to a service call already in progress', async () => {
    const controller = new AbortController();
    const h = harness(subject, () => new Response(BLOCK, { status: 403 }), () => { controller.abort(new Error('cancelled')); });
    await expect(h.adapter.track({ number }, { signal: controller.signal })).rejects.toBeInstanceOf(Error);
    expect(h.requests).toHaveLength(1);
  });

  it('leaves an unresolved HTTP 200 browser challenge challenged', async () => {
    const h = harness(subject, () => new Response(BLOCK, { status: 403 }), page => { page.html = BLOCK; });
    await expect(h.adapter.track({ number })).rejects.toMatchObject({ kind: 'challenge' });
  });

  it('rejects a browser redirect before accepting even a valid history', async () => {
    const h = harness(subject, () => new Response(BLOCK, { status: 403 }), page => { page.url = 'https://other.test/'; });
    await expect(h.adapter.track({ number })).rejects.toMatchObject({ kind: 'transport' });
  });

  it('starts no browser when the caller has insufficient time for recovery', async () => {
    const h = harness(subject, () => new Response(BLOCK, { status: 403 }));
    await expect(h.adapter.track({ number }, { budgetMs: 200 })).rejects.toMatchObject({ kind: 'budget' });
    expect(h.requests).toHaveLength(0);
  });

  it('starts nothing after cancellation', async () => {
    const h = harness(subject, () => new Response(BLOCK));
    const controller = new AbortController();
    const reason = new Error('cancelled');
    controller.abort(reason);
    await expect(h.adapter.track({ number }, { signal: controller.signal })).rejects.toBe(reason);
    expect(h.urls).toHaveLength(0);
  });

  it('rejects a complete browser history belonging to another number', async () => {
    const h = harness(subject, () => new Response(BLOCK, { status: 403 }), page => {
      page.html = String(page.html).replaceAll(number, `${number.slice(0, -1)}9`);
    });
    await expect(h.adapter.track({ number })).rejects.toBeInstanceOf(Error);
  });

  if (id !== 'mrl-global') it('keeps recognition HTTP-only with the service configured', async () => {
    const h = harness(subject, () => new Response(BLOCK, { status: 403 }));
    await expect(h.adapter.recognize!(number)).rejects.toMatchObject({ kind: 'challenge' });
    expect(h.requests).toHaveLength(0);
  });
});
