import { test } from 'node:test';
import assert from 'node:assert/strict';
import { posteItalianeBrowserNumber, runPosteItalianeBrowser } from './poste-italiane-browser.mjs';
const number = 'RA00000000001';
const url = `https://www.poste.it/cerca/index.html#/risultati-spedizioni/${number}`;
const endpoint = 'https://www.poste.it/online/dovequando/DQ-REST/ricercasemplice';
const capture = { captureResponses: [endpoint] };
const gate = { id: 2, tipo: 'error', descrizione: 'CAPTCHA required', token: 'PRIVATE' };
const history = { idTracciatura: number, esitoRicerca: '3', stato: '5', recipient: 'PRIVATE',
  listaMovimenti: [{ statoLavorazione: 'Consegnato', dataOra: 1767484800000, recipient: 'PRIVATE' }] };
function response(status = 200, payload = history, request = {}) {
  return { url: () => endpoint, status: () => status, headers: () => ({ 'set-cookie': 'PRIVATE' }),
    request: () => ({ method: () => 'POST', postDataJSON: () => ({ codiceSpedizione: number, tipoRichiedente: 'WEB', ...request }) }),
    body: async () => Buffer.from(typeof payload === 'string' ? payload : JSON.stringify(payload)) };
}
function fixture() {
  const handlers = {}, state = { closed: 0, policy: 0, solved: 0, signal: null };
  const page = { on: (name, fn) => { handlers[name] = fn; }, off: name => { delete handlers[name]; },
    goto: async () => { handlers.response(response(400, gate)); return { status: () => 200 }; },
    getByRole: () => ({ click: async () => {} }) };
  const options = { url, capture, tier: 3, maxTimeout: 6000,
    handle: { browser: { newContext: async () => ({ newPage: async () => page, close: async () => { state.closed++; } }) } },
    installPolicy: async () => { state.policy++; },
    solveCaptcha: async (_page, _timeout, signal) => {
      state.solved++; state.signal = signal;
      handlers.response(response(200, history, { codiceSpedizione: 'RA00000000002' }));
      handlers.response(response(200, history, { captcha: 'PRIVATE' }));
      // The widget disappears on success before the solver sees its tick.
      return new Promise(resolve => signal.addEventListener('abort', () => resolve(false), { once: true }));
    } };
  return { options, handlers, state, page };
}
test('accepts only one whole identifier on the official page and exact endpoint', () => {
  assert.equal(posteItalianeBrowserNumber(url, capture), number);
  for (const candidate of [url + ',RA00000000002', url + '/extra', url.replace('www.poste.it', 'example.test'),
    url.replace('www.poste.it', 'user@www.poste.it'), url.replace('#', '?extra#'), url.replace(number, 'ABCDEF')]) {
    assert.equal(posteItalianeBrowserNumber(candidate, capture), null);
  }
  assert.equal(posteItalianeBrowserNumber(url, { captureResponses: [endpoint + '?extra'] }), null);
});
test('accepts bound history despite a removed widget, retains challenge provenance and excludes unrelated fields', async () => {
  const f = fixture(); const result = await runPosteItalianeBrowser(f.options);
  assert.deepEqual(result.capturedResponses.map(row => row.status), [400, 200]);
  assert.deepEqual(JSON.parse(result.capturedResponses[1].body), { idTracciatura: number, esitoRicerca: '3', stato: '5',
    listaMovimenti: [{ statoLavorazione: 'Consegnato', dataOra: 1767484800000 }] });
  assert.equal(JSON.stringify(result).includes('PRIVATE'), false);
  assert.equal(result.html, ''); assert.equal(f.state.closed, 1); assert.equal(f.state.policy, 1);
  assert.equal(f.state.signal.aborted, true); assert.deepEqual(f.handlers, {});
});
test('does not solve on a direct result or a non-CAPTCHA error', async () => {
  for (const reply of [response(), response(429), response(400, { id: 3, tipo: 'error' })]) {
    const f = fixture(); f.page.goto = async () => { f.handlers.response(reply); return { status: () => 200 }; };
    await runPosteItalianeBrowser(f.options);
    assert.equal(f.state.solved, 0); assert.equal(f.state.closed, 1);
  }
});
test('waits for the final response after solver success and retains a rejected token as challenge', async () => {
  const f = fixture(); f.options.solveCaptcha = async () => { setTimeout(() => f.handlers.response(response()), 10); return true; };
  assert.equal((await runPosteItalianeBrowser(f.options)).capturedResponses.at(-1).status, 200);
  const denied = fixture(); denied.options.solveCaptcha = async () => { denied.handlers.response(response(400, gate, { captcha: 'PRIVATE' })); return true; };
  assert.deepEqual((await runPosteItalianeBrowser(denied.options)).capturedResponses.map(row => row.status), [400, 400]);
});
test('returns an unsolved challenge promptly and bounds bodies, response counts and deadline cleanup', async () => {
  const refused = fixture(); refused.options.solveCaptcha = async () => false;
  assert.equal((await runPosteItalianeBrowser(refused.options)).capturedResponses[0].status, 400);
  const large = fixture(); large.options.solveCaptcha = async () => { large.handlers.response(response(200, 'x'.repeat(1_000_001))); return true; };
  assert.equal((await runPosteItalianeBrowser(large.options)).capturedResponses.at(-1).truncated, true);
  const many = fixture(); many.options.solveCaptcha = async () => { for (let i = 0; i < 12; i++) many.handlers.response(response(400, gate)); return true; };
  const result = await runPosteItalianeBrowser(many.options);
  assert.equal(result.capturedResponses.length, 10); assert.match(result.capturedResponses.at(-1).error, /limit/);
  const deadline = fixture(); deadline.options.maxTimeout = 15; deadline.page.goto = () => new Promise(() => {});
  assert.equal((await runPosteItalianeBrowser(deadline.options)).status, 'error'); assert.equal(deadline.state.closed, 1);
});
test('cancels the solver and closes only its own context on caller cancellation', async () => {
  const f = fixture(); const controller = new AbortController(); f.options.signal = controller.signal;
  f.options.solveCaptcha = async (_page, _timeout, signal) => { f.state.signal = signal; controller.abort(); return new Promise(() => {}); };
  const result = await runPosteItalianeBrowser(f.options);
  assert.equal(result.capturedResponses[0].status, 400); assert.equal(f.state.signal.aborted, true); assert.equal(f.state.closed, 1);
});
