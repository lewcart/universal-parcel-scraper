import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chinaPostBrowserNumber, projectChinaPostWebReply, runChinaPostBrowser } from './china-post-browser.mjs';

const number = 'ZS00000000001', other = 'ZS00000000002';
const flag = 'https://www.ems.com.cn/ems-web/trackTestQuery/getLogisticsTestFlag';
const api = 'https://www.ems.com.cn/ems-web/mailTrack/queryTrack';
const url = `https://www.ems.com.cn/queryList?mailNo=${number}`, capture = { captureResponses: [flag, api] };
const found = { success: true, token: 'PRIVATE', value: { domesticMailResultDtoList: [{ resCode: 'true', traceNo: '',
  receiverAddress: 'PRIVATE', resObj: [{ traceNo: number, bubbleTime: '2030-01-02 12:30', opStateCode: 'O_051',
    opName: '到达境外目的地', opDesc: 'PRIVATE', senderPhone: 'PRIVATE', gis: 'PRIVATE' }] }] } };
const response = (payload = found, overrides = {}) => ({ url: () => api, status: () => 200,
  request: () => ({ method: () => 'POST', postDataJSON: () => ({ list: [number], value: [{ orderNum: [number] }] }) }),
  headers: () => ({ 'content-type': 'application/json', 'set-cookie': 'PRIVATE' }),
  body: async () => Buffer.from(JSON.stringify(payload)), ...overrides });
function fixture() {
  const handlers = {}, state = { closed: 0, counted: 0, navigated: 0 };
  let submitted = number;
  const page = {
    on: (name, fn) => { handlers[name] = fn; }, off: name => { delete handlers[name]; },
    goto: async () => { state.navigated++; return { status: () => 200 }; },
    locator: () => ({ fill: async n => { submitted = n; }, inputValue: async () => submitted,
      waitFor: async () => {}, evaluate: async () => {} }),
    waitForResponse: async () => ({ status: () => 200, body: async () => Buffer.from(JSON.stringify({ data: {
      backgroundImageWidth: 100, backgroundImageHeight: 100,
    } })) }),
    getByRole: (_role, { name }) => ({ evaluate: async () => { if (name === '验证') handlers.response(response()); } }),
  };
  const context = { newPage: async () => page, close: async () => { state.closed++; } };
  return { page, context, handlers, state, options: { url, capture, tier: 3, maxTimeout: 200,
    solveCharacters: async () => [{ x: 20, y: 20 }, { x: 40, y: 40 }],
    handle: { browser: { newContext: async () => context }, noteTemporaryContext: () => { state.counted++; } } } };
}

test('scopes the helper to the exact China Post page, number and endpoints', () => {
  assert.equal(chinaPostBrowserNumber(url, capture), number);
  for (const raw of [url + '#x', url + '&extra=1', url.replace('www.ems.com.cn', 'example.test'),
    url.replace('www.ems.com.cn', 'user@www.ems.com.cn'), url.replace(number, number + '0')]) assert.equal(chinaPostBrowserNumber(raw, capture), null);
  assert.equal(chinaPostBrowserNumber(url, { captureResponses: [api] }), null);
  assert.equal(chinaPostBrowserNumber(url.replace(number, 'ZC00000000001'), capture), 'ZC00000000001');
  assert.equal(chinaPostBrowserNumber(url.replace(number, 'ZA00000000001'), capture), 'ZA00000000001');
  assert.equal(chinaPostBrowserNumber(url.replace(number, 'ZT00000000001'), capture), null);
});
test('projects only matching scan identity, clocks and state labels', () => {
  const value = projectChinaPostWebReply(found, number);
  assert.equal(value.match, true); assert.equal(value.scans[0].state, '到达境外目的地');
  assert.equal(JSON.stringify(value).includes('PRIVATE'), false);
  assert.equal(projectChinaPostWebReply(found, other).match, false);
  assert.equal(projectChinaPostWebReply({ success: false, message: '验证失败 PRIVATE' }, number).reason, 'verification');
  assert.equal(projectChinaPostWebReply({ success: false, message: '请输入手机后四位' }, number).reason, 'phone');
});
test('observes before navigation, retains the response sequence and cleans up', async () => {
  const f = fixture();
  f.page.getByRole = (_role, { name }) => ({ evaluate: async () => {
    if (name === '验证') { f.handlers.response(response({ success: false, message: '验证失败' })); f.handlers.response(response()); }
  } });
  const result = await runChinaPostBrowser(f.options);
  assert.equal(result.capturedResponses.length, 2);
  assert.equal(JSON.parse(result.capturedResponses[0].body).reason, 'verification');
  assert.equal(JSON.parse(result.capturedResponses[1].body).match, true);
  assert.equal(result.capturedResponses[1].trackingNumberSubmitted, number);
  assert.equal(JSON.stringify(result).includes('PRIVATE'), false);
  assert.equal(result.html, ''); assert.equal(f.state.closed, 1); assert.equal(f.state.counted, 1); assert.deepEqual(f.handlers, {});
});
test('ignores unrelated, partial, batched and non-POST requests', async () => {
  const f = fixture(); f.page.getByRole = (_role, { name }) => ({ evaluate: async () => {
    if (name !== '验证') return;
    for (const r of [response(found, { url: () => api + '/wrong' }), response(found, { request: () => ({ method: () => 'GET' }) }),
      ...[other, number.slice(0, -1)].map(n => response(found, { request: () => ({ method: () => 'POST', postDataJSON: () => ({ list: [n], value: [{ orderNum: [n] }] }) }) })),
      response(found, { request: () => ({ method: () => 'POST', postDataJSON: () => ({ list: [number, other], value: [{ orderNum: [number] }] }) }) })]) f.handlers.response(r);
    f.handlers.response(response());
  } });
  assert.equal((await runChinaPostBrowser(f.options)).capturedResponses.length, 1);
});
test('drops firewall query material while binding the endpoint and request body', async () => {
  const f = fixture(); f.page.getByRole = (_role, { name }) => ({ evaluate: async () => {
    if (name === '验证') f.handlers.response(response(found, { url: () => api + '?firewall=PRIVATE' }));
  } });
  const result = await runChinaPostBrowser(f.options);
  assert.equal(result.capturedResponses[0].url, api);
  assert.equal(JSON.stringify(result).includes('PRIVATE'), false);
});
test('uses a fresh puzzle after an explicit refusal and keeps the refused attempt', async () => {
  const f = fixture(); let submissions = 0, solves = 0;
  f.options.solveCharacters = async () => { solves++; return [{ x: 20, y: 20 }, { x: 40, y: 40 }]; };
  f.page.getByRole = (_role, { name }) => ({ evaluate: async () => {
    if (name !== '验证') return;
    submissions++;
    f.handlers.response(submissions === 1 ? response({ success: false, message: '验证失败' }) : response());
  } });
  const r = await runChinaPostBrowser({ ...f.options, maxTimeout: 14000 });
  assert.equal(solves, 2); assert.equal(submissions, 2);
  assert.equal(JSON.parse(r.capturedResponses[0].body).reason, 'verification');
  assert.equal(JSON.parse(r.capturedResponses[1].body).match, true);
});
test('preserves rejections and bounds body reads', async () => {
  for (const overrides of [{ status: () => 403 }, { status: () => 429 }, { headers: () => ({ 'content-length': '1000001' }) },
    { body: async () => Buffer.alloc(1000001) }]) {
    const f = fixture(); f.page.getByRole = (_role, { name }) => ({ evaluate: async () => { if (name === '验证') f.handlers.response(response(found, overrides)); } });
    const r = (await runChinaPostBrowser(f.options)).capturedResponses[0];
    assert.ok(r.status !== 200 || r.truncated); assert.equal(r.body, null);
  }
});
test('ends stalled work, aborts OCR and closes late contexts', async () => {
  const f = fixture(); let signal;
  f.options.solveCharacters = async (_challenge, s) => { signal = s; return new Promise(() => {}); };
  await runChinaPostBrowser({ ...f.options, maxTimeout: 10 });
  assert.equal(signal.aborted, true); assert.equal(f.state.closed, 1);
  const late = fixture(); let release;
  late.options.handle.browser.newContext = () => new Promise(resolve => { release = resolve; });
  await runChinaPostBrowser({ ...late.options, maxTimeout: 5 });
  release(late.context); await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(late.state.closed, 1); assert.equal(late.state.navigated, 0);
});
