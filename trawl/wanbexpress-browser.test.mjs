import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runWanbBrowser, wanbBrowserNumber } from './wanbexpress-browser.mjs';

const number = 'WNBZZ9990000001YQ';
const api = 'https://tracking.wanbexpress.com/TrackPoints/Track';
const url = `https://tracking.wanbexpress.com/?trackingNumbers=${number}`;
const capture = { captureResponses: [api] };
const challenge = JSON.stringify({ Succeeded: false, Error: { Code: '0x110012' } });
const body = JSON.stringify({ Succeeded: true, Data: { TrackingNumber: number } });
const response = (value = body, status = 200, id = number) => ({
  url: () => `${api}?TrackingNumber=${id}`, status: () => status, request: () => ({ method: () => 'GET' }),
  headers: () => ({ 'content-type': 'application/json', 'set-cookie': 'PRIVATE' }), body: async () => Buffer.from(value),
});
function fixture() {
  const handlers = {}, state = { closed: 0, counted: 0, replaced: 0, policy: 0 };
  const page = { on: (name, fn) => { handlers[name] = fn; }, off: name => { delete handlers[name]; },
    goto: async () => { handlers.response(response(challenge)); return { status: () => 200 }; },
    evaluate: async () => { handlers.response(response(body, 200, 'WNBZZ9990000002YQ')); handlers.response(response()); },
  };
  const context = { newPage: async () => page, close: async () => { state.closed++; } };
  const options = { url, capture, tier: 3, maxTimeout: 500, handle: { browser: { newContext: async () => context },
    noteTemporaryContext: () => { state.counted++; }, requestBrowserReplacement: () => { state.replaced++; } },
  installPolicy: async () => { state.policy++; } };
  return { options, handlers, state, page };
}

test('WanbExpress runner accepts only its exact tracking URL and capture endpoint', () => {
  assert.equal(wanbBrowserNumber(url, capture), number);
  for (const candidate of [url + '#extra', url + '&trackingNumbers=' + number, url.replace('tracking.wanbexpress.com', 'example.test'),
    url.replace('tracking.wanbexpress.com', 'user@tracking.wanbexpress.com'), url.replace(number, '1234567890')]) {
    assert.equal(wanbBrowserNumber(candidate, capture), null);
  }
  assert.equal(wanbBrowserNumber(url, { captureResponses: [api, 'https://example.test'] }), null);
});

test('observes before navigation, retains the verification transition and ignores another parcel', async () => {
  const { options, handlers, state } = fixture();
  const result = await runWanbBrowser(options);
  assert.deepEqual(result.capturedResponses.map(row => row.body), [challenge, body]);
  assert.equal(JSON.stringify(result).includes('PRIVATE'), false);
  assert.equal(result.html, '');
  assert.equal(state.closed, 1);
  assert.equal(state.counted, 1);
  assert.equal(state.policy, 1);
  assert.deepEqual(handlers, {});
});

test('preserves a final rejection and closes when verification fails or the budget expires', async () => {
  for (const status of [403, 429]) {
    const active = fixture(); active.page.evaluate = async () => { active.handlers.response(response('PRIVATE', status)); };
    const result = await runWanbBrowser(active.options);
    assert.equal(result.capturedResponses.at(-1).status, status);
    assert.equal(result.capturedResponses.at(-1).body, null);
    assert.equal(active.state.closed, 1);
  }
  const failed = fixture(); failed.page.evaluate = async () => { throw new Error('verification failed'); };
  assert.equal((await runWanbBrowser(failed.options)).capturedResponses[0].body, challenge);
  const hung = fixture(); hung.options.maxTimeout = 20; hung.page.evaluate = () => new Promise(() => {});
  assert.equal((await runWanbBrowser(hung.options)).capturedResponses[0].body, challenge);
  assert.equal(hung.state.closed, 1);
});

test('bounds response bodies and repeated tracking responses', async () => {
  const large = fixture(); large.page.evaluate = async () => { large.handlers.response(response('x'.repeat(1_000_001))); };
  assert.equal((await runWanbBrowser(large.options)).capturedResponses.at(-1).truncated, true);
  const many = fixture(); many.page.evaluate = async () => { for (let i = 0; i < 12; i++) many.handlers.response(response(challenge)); };
  const result = await runWanbBrowser(many.options);
  assert.equal(result.capturedResponses.length, 10);
  assert.match(result.capturedResponses.at(-1).error, /limit/);
});
