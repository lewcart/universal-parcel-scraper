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

const SERVICE = 'https://browser.test/scrape';
const BLOCK = '<html><title>Just a moment...</title><script>window._cf_chl_opt={}</script></html>';
const subjects: [string, AdapterFactory, string, string][] = [
  ['pro-carrier', proCarrier, 'DG00000000001', 'delivered'],
  ['delnext', delnext, 'DNX4T7', 'delivered'],
  ['mrl-global', mrl, 'CAAA000001', 'delivered'],
  ['ait-worldwide', ait, '555000111', 'delivered'],
  ['hitch', hitch, 'ZIP0SYNTHETIC01', 'delivered'],
  ['pbt', pbt, 'ZZD00000002', 'delivered'],
  ['celeritas', celeritas, '912345670', 'transit'],
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
