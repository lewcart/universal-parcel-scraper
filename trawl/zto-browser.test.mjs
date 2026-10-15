import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projectZtoReply, runZtoBrowser, ztoBrowserNumber } from './zto-browser.mjs';

const number = '79990000000001', api = 'https://hdgateway.zto.com/batchGetTrace';
const url = `https://www.zto.com/check/detail?waybills=${number}`, capture = { captureResponses: [api] };
const challenge = { status: false, statusCode: '10201', message: '请输入验证码', token: 'PRIVATE' };
const found = { status: true, statusCode: 'E0000', result: { items: [{ billCode: number, recipient: 'PRIVATE', traces: [
  { traceTime: 1900000000000, traceTypeCode: 'SIGNED', traceTypeDesc: '签收', traceSiteName: 'Example depot', traceDescText: 'PRIVATE' },
] }] } };
const response = (payload = found, overrides = {}) => ({ url: () => api, status: () => 200,
  request: () => ({ method: () => 'POST', postDataJSON: () => ({ items: [{ billCode: number }] }) }),
  headers: () => ({ 'content-type': 'application/json', 'set-cookie': 'PRIVATE' }),
  body: async () => Buffer.from(JSON.stringify(payload)), ...overrides });
function fixture() {
  const handlers = {}, state = { closed: 0, counted: 0, navigated: 0 };
  const page = { on: (name, fn) => { handlers[name] = fn; }, off: name => { delete handlers[name]; },
    goto: async () => { state.navigated++; handlers.response(response()); return { status: () => 200 }; }, evaluate: async () => null,
    route: async (pattern, handler) => {
      assert.equal(pattern.test('https://hm.baidu.com/hm.js'), true);
      assert.equal(pattern.test('https://dlswbr.baidu.com/heicha/script.js'), true);
      assert.equal(pattern.test('https://api.map.baidu.com/api'), false);
      assert.equal(pattern.test('https://cap-8.dingxiang-inc.com/api/a'), false);
      let refused = false; await handler({ abort: async () => { refused = true; } }); assert.equal(refused, true);
    } };
  const context = { newPage: async () => page, close: async () => { state.closed++; } };
  return { page, context, handlers, state, options: { url, capture, tier: 3, maxTimeout: 500,
    handle: { browser: { newContext: async () => context }, noteTemporaryContext: () => { state.counted++; } } } };
}
test('only the domestic ZTO page and exact capture endpoint enter the helper', () => {
  assert.equal(ztoBrowserNumber(url, capture), number);
  for (const value of [url + '&extra=1', url + '#x', url.replace('www.zto.com', 'example.test'), url.replace(number, number + '0'), url.replace('www.zto.com', 'user@www.zto.com')]) assert.equal(ztoBrowserNumber(value, capture), null);
  assert.equal(ztoBrowserNumber(url, { captureResponses: [api, 'https://example.test'] }), null);
});
test('projects identity and scan clocks without token or recipient fields', () => {
  assert.equal(JSON.stringify(projectZtoReply(found, number)).includes('PRIVATE'), false);
  assert.equal(JSON.stringify(projectZtoReply(challenge, number)).includes('PRIVATE'), false);
  assert.equal(projectZtoReply(found, '79990000000002').result, undefined);
  assert.equal(projectZtoReply({ ...challenge, message: '访问频繁' }, number).message, 'rate limit');
});
test('observes before navigation and retains challenge then tracking with cleanup', async () => {
  const f = fixture();
  f.page.goto = async () => { f.handlers.response(response(challenge)); f.handlers.response(response()); return { status: () => 200 }; };
  const result = await runZtoBrowser(f.options);
  assert.equal(result.capturedResponses.length, 2);
  assert.equal(JSON.parse(result.capturedResponses[0].body).statusCode, '10201');
  assert.equal(JSON.parse(result.capturedResponses[1].body).statusCode, 'E0000');
  assert.equal(result.capturedResponses[1].trackingNumberSubmitted, number);
  assert.equal(JSON.stringify(result).includes('PRIVATE'), false);
  assert.equal(f.state.closed, 1); assert.equal(f.state.counted, 1); assert.deepEqual(f.handlers, {});
});
test('ignores another identifier, method, origin and ambiguous batch', async () => {
  const f = fixture();
  f.page.goto = async () => {
    for (const r of [response(found, { url: () => api + '?x=1' }), response(found, { url: () => 'https://example.test/batchGetTrace' }),
      response(found, { request: () => ({ method: () => 'GET' }) }),
      response(found, { request: () => ({ method: () => 'POST', postDataJSON: () => ({ items: [{ billCode: '79990000000002' }] }) }) }),
      response(found, { request: () => ({ method: () => 'POST', postDataJSON: () => ({ items: [{ billCode: number }, { billCode: number }] }) }) })]) f.handlers.response(r);
    f.handlers.response(response());
  };
  assert.equal((await runZtoBrowser(f.options)).capturedResponses.length, 1);
});
test('bounds response bytes and preserves final HTTP rejections', async () => {
  for (const status of [403, 429, 503]) {
    const f = fixture(); f.page.goto = async () => { f.handlers.response(response(found, { status: () => status })); };
    const result = await runZtoBrowser(f.options);
    assert.equal(result.capturedResponses[0].status, status); assert.equal(result.capturedResponses[0].body, null);
  }
  for (const declared of [true, false]) {
    const f = fixture(); f.page.goto = async () => { f.handlers.response(response(found, {
      headers: () => ({ 'content-length': declared ? '1000001' : '20' }),
      body: async () => { assert.equal(declared, false); return Buffer.alloc(1000001); },
    })); };
    assert.equal((await runZtoBrowser(f.options)).capturedResponses[0].truncated, true);
  }
});
test('retains the challenge on deadline or cancellation and closes late contexts', async () => {
  const f = fixture(); f.page.goto = async () => { f.handlers.response(response(challenge)); return new Promise(() => {}); };
  const result = await runZtoBrowser({ ...f.options, maxTimeout: 10 });
  assert.equal(JSON.parse(result.capturedResponses[0].body).statusCode, '10201'); assert.equal(f.state.closed, 1);
  const cancelled = fixture();
  assert.equal((await runZtoBrowser({ ...cancelled.options, signal: AbortSignal.abort() })).status, 'error');
  assert.equal(cancelled.state.counted, 0);
  const late = fixture(); let release;
  late.options.handle.browser.newContext = () => new Promise(resolve => { release = resolve; });
  assert.equal((await runZtoBrowser({ ...late.options, maxTimeout: 5 })).status, 'error');
  release(late.context); await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(late.state.closed, 1); assert.equal(late.state.navigated, 0);
});
