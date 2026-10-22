import { afterEach, expect, it, vi } from 'vitest';
import { ChallengeError } from '../../core/errors/index.js';
import { NOOP_RECORDER } from '../../core/telemetry/index.js';
import { adapter } from './adapter.js';
import { fetchCorreosChileInBrowser } from './browser.js';

vi.mock('./browser.js', () => ({ fetchCorreosChileInBrowser: vi.fn() }));
const number = 'SX000000005CL';
function tracker(configured = true, status = 403) {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('blocked', { status }));
  const recorder = { ...NOOP_RECORDER, step: vi.fn(), lookup: vi.fn() };
  return { recorder, fetcher, carrier: adapter({ fetcher, recorder,
    env: configured ? { CORREOS_CHILE_BROWSER_WS_ENDPOINT: 'ws://browser.test/synthetic' } : {},
    trawl: null, browserExecutablePath: null }) };
}
afterEach(() => { vi.clearAllMocks(); });

it('recovers only the direct challenge inside the supplied budget and records provenance', async () => {
  const h = tracker();
  vi.mocked(fetchCorreosChileInBrowser).mockResolvedValue({ status: 'delivered', last_status_text: 'Delivered', last_update: null, expected_delivery: null, events: [] });
  await expect(h.carrier.track({ number }, { budgetMs: 20_000 })).resolves.toMatchObject({ status: 'delivered' });
  expect(fetchCorreosChileInBrowser).toHaveBeenCalledWith(number, 'ws://browser.test/synthetic', expect.any(AbortSignal), expect.any(Number), undefined);
  expect(vi.mocked(fetchCorreosChileInBrowser).mock.calls[0]![3]).toBeLessThanOrEqual(20_000);
  expect(h.recorder.step.mock.calls.map(([r]) => [r.step, r.outcome])).toEqual([['direct', 'challenge'], ['browser', 'ok']]);
  expect(h.recorder.step).toHaveBeenLastCalledWith(expect.objectContaining({ fallbackFrom: 'direct', fallbackReason: 'challenge' }));
  expect(h.carrier.recognize).toBeUndefined();
});

it('keeps challenges when recovery is absent, too late or refused', async () => {
  await expect(tracker(false).carrier.track({ number })).rejects.toMatchObject({ kind: 'challenge' });
  await expect(tracker().carrier.track({ number }, { budgetMs: 1000 })).rejects.toMatchObject({ kind: 'challenge' });
  expect(fetchCorreosChileInBrowser).not.toHaveBeenCalled();
  vi.mocked(fetchCorreosChileInBrowser).mockRejectedValue(new ChallengeError('Correos de Chile'));
  await expect(tracker().carrier.track({ number })).rejects.toMatchObject({ kind: 'challenge' });
});

it('does not retry rate limits, missing resources, malformed replies or cancellation', async () => {
  for (const status of [429, 404, 200]) await expect(tracker(true, status).carrier.track({ number })).rejects.toBeDefined();
  const h = tracker(), controller = new AbortController(); controller.abort();
  await expect(h.carrier.track({ number }, { signal: controller.signal })).rejects.toBeDefined();
  expect(h.fetcher).not.toHaveBeenCalled();
  expect(fetchCorreosChileInBrowser).not.toHaveBeenCalled();
});
