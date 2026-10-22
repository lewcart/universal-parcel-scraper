import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { attachSwiftxSlider, locateSwiftxSlider, swiftxSliderDrag } from './swiftx-slider.mjs';

const API = 'https://swiftx-express.com/api/graphql';
const NUMBER = 'SWX000000000000000001';
const digest = createHash('sha256').update(NUMBER).digest('hex');
const tick = () => new Promise(resolve => setImmediate(resolve));
const challenge = (id = 'SYNTHETIC_A', type = 'SLIDER') => ({ success: true, captchaId: id, type,
  backgroundImage: 'data:image/png;base64,AA==', templateImage: 'data:image/png;base64,AQ==',
  backgroundImageWidth: 600, backgroundImageHeight: 360, templateImageWidth: 110, templateImageHeight: 360 });
const imageQuery = { query: 'query { getOfficialTrackingSliderCaptcha { success } }' };
const verifyQuery = (id = 'SYNTHETIC_A', bindingDigest = digest) => ({ query: 'mutation { verifyOfficialTrackingSlider(input: $input) { success } }',
  variables: { input: { captchaId: id, bindingDigest } } });

function fixture(options = {}) {
  const page = new EventEmitter();
  let refreshes = 0, moves = 0, downs = 0, ups = 0;
  const geometry = { x: 30, y: 100, scale: 320 / 600, maxKnob: 276, maxImage: 261 };
  page.evaluate = async () => geometry;
  page.getByRole = () => ({ locator: () => ({ first: () => ({ evaluate: async () => { refreshes++; await options.refresh?.(); } }) }) });
  page.mouse = { move: async () => { moves++; await options.move?.(); }, down: async () => { downs++; }, up: async () => { ups++; await options.up?.(); } };
  const controller = attachSwiftxSlider(page, NUMBER, { solve: async () => null, ...options });
  const respond = async (payload, request = imageQuery, { status = 200, headers = {}, read, url = API } = {}) => {
    page.emit('response', { url: () => url, status: () => status, headers: () => ({ 'content-type': 'application/json', ...headers }),
      request: () => ({ method: () => 'POST', postDataJSON: () => request }), body: read ?? (async () => Buffer.from(JSON.stringify({ data: payload }))) });
    await tick();
  };
  return { page, controller, respond, stats: () => ({ refreshes, moves, downs, ups }) };
}

test('maps native puzzle displacement through the page’s scaled slider geometry', () => {
  const drag = swiftxSliderDrag({ x: 30, y: 100, scale: .5, maxKnob: 256, maxImage: 245 }, { x: 245 });
  assert.deepEqual(drag, { x: 30, y: 100, distance: 128 });
  for (const geometry of [null, {}, { x: 0, y: 0, scale: 1, maxKnob: 100, maxImage: 0 }]) assert.equal(swiftxSliderDrag(geometry, { x: 100 }), null);
  assert.equal(swiftxSliderDrag({ x: 0, y: 0, scale: 1, maxKnob: 100, maxImage: 100 }, { x: 1000 }), null);
});

test('does not start image analysis after cancellation', async () => {
  const stopped = new AbortController(); stopped.abort();
  assert.equal(await locateSwiftxSlider(challenge(), stopped.signal, 4000), null);
});

test('refreshes an unreadable or unsupported puzzle only once', async () => {
  let f;
  f = fixture({ refresh: () => f.respond({ getOfficialTrackingSliderCaptcha: challenge('SYNTHETIC_B', 'ROTATE') }) });
  await f.respond({ getOfficialTrackingSliderCaptcha: challenge() });
  assert.equal(await f.controller.prepare(8000), undefined);
  assert.deepEqual(f.stats(), { refreshes: 1, moves: 0, downs: 0, ups: 0 });
  f.controller.dispose();
  assert.equal(f.page.listenerCount('response'), 0);
});

test('does not drag a stale generation after image analysis', async () => {
  let f, calls = 0;
  f = fixture({ solve: async () => {
    calls++;
    if (calls === 1) { await f.respond({ getOfficialTrackingSliderCaptcha: challenge('SYNTHETIC_B') }); return { x: 200 }; }
    return null;
  } });
  await f.respond({ getOfficialTrackingSliderCaptcha: challenge() });
  await f.controller.prepare(6000);
  assert.equal(calls, 2);
  assert.equal(f.stats().downs, 0);
  f.controller.dispose();
});

test('stops before dragging when the caller cancels during pointer placement', async () => {
  const stopped = new AbortController();
  const f = fixture({ signal: stopped.signal, solve: async () => ({ x: 200 }), move: () => stopped.abort() });
  await f.respond({ getOfficialTrackingSliderCaptcha: challenge() });
  await f.controller.prepare(6000);
  assert.equal(f.stats().downs, 0);
  f.controller.dispose();
});

test('uses the official pointer control, then stops once its bound verification succeeds', async () => {
  let f;
  f = fixture({ solve: async () => ({ x: 200 }), up: () => f.respond({ verifyOfficialTrackingSlider: { success: true, sliderToken: 'SYNTHETIC_TOKEN' } }, verifyQuery()) });
  await f.respond({ getOfficialTrackingSliderCaptcha: challenge() });
  assert.equal(await f.controller.prepare(6000), undefined);
  assert.deepEqual(f.stats(), { refreshes: 0, moves: 3, downs: 1, ups: 1 });
  f.controller.dispose();
});

test('ignores verification for another number or challenge generation', async () => {
  const f = fixture();
  await f.respond({ getOfficialTrackingSliderCaptcha: challenge() });
  for (const request of [verifyQuery('SYNTHETIC_B'), verifyQuery('SYNTHETIC_A', 'OTHER_DIGEST')]) {
    await f.respond({}, request, { status: 429, read: () => { throw new Error('must not read refusal'); } });
  }
  assert.equal(await f.controller.prepare(0), undefined);
  f.controller.dispose();
});

test('preserves a bound verification refusal without reading its body or cookies', async () => {
  const f = fixture();
  await f.respond({ getOfficialTrackingSliderCaptcha: challenge() });
  await f.respond({}, verifyQuery(), { status: 429, headers: { 'retry-after': '60', 'set-cookie': 'PRIVATE' }, read: () => { throw new Error('must not read refusal'); } });
  assert.deepEqual(await f.controller.prepare(0), { status: 429, retryAfter: '60' });
  f.controller.dispose();
});

test('preserves an explicit image-fetch rate limit and closes its observer with the page', async () => {
  const f = fixture();
  await f.respond({ getOfficialTrackingSliderCaptcha: { success: false, errorCode: 'SLIDER_FETCH_RATE_LIMITED' } });
  assert.deepEqual(await f.controller.prepare(0), { status: 429 });
  f.page.emit('close');
  assert.equal(f.page.listenerCount('response'), 0);
});

test('an image offered after preparation is solved without blocking the existing Turnstile path', async () => {
  let f, done;
  const finished = new Promise(resolve => { done = resolve; });
  f = fixture({ solve: async () => ({ x: 200 }), up: async () => {
    await f.respond({ verifyOfficialTrackingSlider: { success: true, sliderToken: 'SYNTHETIC_TOKEN' } }, verifyQuery());
    done();
  } });
  assert.equal(await f.controller.prepare(6000), undefined);
  await f.respond({ getOfficialTrackingSliderCaptcha: challenge() });
  await finished;
  assert.equal(f.stats().downs, 1);
  f.controller.dispose();
});

const python = process.env.SWIFTX_SLIDER_PYTHON ?? '/opt/zto-ocr/bin/python';
test('locates synthetic cutouts and image seams and rejects ambiguous images', { skip: !existsSync(python) }, () => {
  execFileSync(python, [fileURLToPath(new URL('./swiftx-slider.test.py', import.meta.url))], {
    timeout: 10_000, stdio: 'pipe', env: { ...process.env, OPENBLAS_NUM_THREADS: '1' },
  });
});
