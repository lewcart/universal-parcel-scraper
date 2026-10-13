import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dhlPolandBrowserNumber, dhlPolandHistory, runDhlPolandBrowser } from './dhl-poland-browser.mjs';

const number = '99999999990';
const endpoint = 'https://sprawdz.dhl.com.pl/';
const url = `${endpoint}?sn=${number}&lang=en-gb`;
const capture = { captureResponses: [endpoint] };
const html = `<html><textarea name="g-recaptcha-response">PRIVATE</textarea><div class="trackHead"><b class="dhl_black_color">${number}</b></div>
<div id="addit_infoHead"><div class="topBotPads15"><div>04.03.2026</div><div>10:15</div><div>Example depot</div>
<div>Delivered to customer. The shipment received by PRIVATE</div></div></div><input value="PRIVATE"></html>`;
const response = (status = 200, body = html, submitted = number) => ({ url: () => endpoint, status: () => status,
  request: () => ({ method: () => 'POST', postData: () => `SearchMode=Shipment&ShipmentNumbers=${submitted}&g-recaptcha-response=PRIVATE` }),
  headers: () => ({ 'content-type': 'text/html', 'set-cookie': 'PRIVATE' }), body: async () => Buffer.from(body) });
function fixture() {
  const handlers = {}, state = { closed: 0, submitted: 0, policy: 0, solved: 0 };
  const page = { on: (event, fn) => { handlers[event] = fn; }, off: event => { delete handlers[event]; },
    goto: async () => ({ status: () => 200 }), waitForTimeout: async () => {},
    frameLocator: () => ({ first: () => ({ locator: () => ({ click: async () => {} }) }) }),
    waitForFunction: async () => {},
    locator: selector => {
      if (selector === '#onetrust-reject-all-handler') return { waitFor: async () => {}, evaluate: async () => {} };
      if (selector === '#sn') return { fill: async value => assert.equal(value, number) };
      if (selector.includes('iframe')) return { first: () => ({ scrollIntoViewIfNeeded: async () => {} }) };
      if (selector === '#g-recaptcha-response') return { inputValue: async () => 'PRIVATE' };
      return { click: async () => { state.submitted++; handlers.response(response()); } };
    },
  };
  const options = { url, capture, tier: 3, maxTimeout: 1000,
    handle: { browser: { newContext: async () => ({ newPage: async () => page, close: async () => { state.closed++; } }) } },
    solveCaptcha: async () => { state.solved++; }, installPolicy: async () => { state.policy++; },
  };
  return { options, handlers, state, page };
}
test('only the exact carrier URL, canonical waybill and capture endpoint select the helper', () => {
  assert.equal(dhlPolandBrowserNumber(url, capture), number);
  for (const candidate of [url + '#x', url + '&sn=' + number, url.replace(number, 'JJD00000000000000000'),
    url.replace('sprawdz.dhl.com.pl', 'other.test'), url.replace('sprawdz.dhl.com.pl', 'user@sprawdz.dhl.com.pl')]) {
    assert.equal(dhlPolandBrowserNumber(candidate, capture), null);
  }
});
test('extracts only safe history fields and identifies an unresolved verification form', () => {
  assert.deepEqual(dhlPolandHistory(html), { number, events: [{ date: '04.03.2026', time: '10:15',
    location: 'Example depot', description: 'Delivered to customer.' }] });
  assert.deepEqual(dhlPolandHistory('<div class="g-recaptcha">PRIVATE</div>'), { challenge: true });
  assert.equal(JSON.stringify(dhlPolandHistory(html.replace('The shipment received by PRIVATE', 'Przesyłka odebrana przez PRIVATE'))).includes('PRIVATE'), false);
  assert.deepEqual(dhlPolandHistory(html.replace('</html>', '<div class="trackHead"><b class="dhl_black_color">99999999991</b></div></html>')), { challenge: true });
});
test('observes before navigation, submits through the verified form and closes its context', async () => {
  const active = fixture(); const result = await runDhlPolandBrowser(active.options);
  assert.equal(result.capturedResponses[0].trackingNumberSubmitted, number);
  assert.equal(JSON.stringify(result).includes('PRIVATE'), false);
  assert.deepEqual(active.state, { closed: 1, submitted: 1, policy: 1, solved: 0 });
  assert.deepEqual(active.handlers, {});
});
test('rejects prefix matches and repeated form fields, keeping a later rejection', async () => {
  const active = fixture(); const original = active.page.locator;
  active.page.locator = selector => selector !== '#searchSubmit' ? original(selector) : { click: async () => {
    active.handlers.response(response(200, html, '0' + number));
    active.handlers.response(response(200, html, number + '&ShipmentNumbers=' + number));
    active.handlers.response(response()); active.handlers.response(response(403, 'PRIVATE'));
  } };
  const result = await runDhlPolandBrowser(active.options);
  assert.deepEqual(result.capturedResponses.map(row => row.status), [200, 403]);
  assert.equal(JSON.stringify(result).includes('PRIVATE'), false);
});
test('retains oversized or repeated response failures without their content', async () => {
  const active = fixture(); const original = active.page.locator;
  active.page.locator = selector => selector !== '#searchSubmit' ? original(selector) : { click: async () => {
    active.handlers.response(response(200, 'PRIVATE'.repeat(100000)));
  } };
  const result = await runDhlPolandBrowser(active.options);
  assert.equal(result.capturedResponses[0].truncated, true);
  assert.equal(JSON.stringify(result).includes('PRIVATE'), false);
});
test('an unsolved or stalled CAPTCHA cannot submit and cleanup stays within the budget', async () => {
  for (const stall of [false, true]) {
    const active = fixture(); active.options.maxTimeout = 30;
    const original = active.page.locator;
    active.page.locator = selector => selector === '#g-recaptcha-response' ? { inputValue: async () => '' } : original(selector);
    if (stall) active.page.waitForFunction = () => new Promise(() => {});
    const result = await runDhlPolandBrowser(active.options);
    assert.equal(active.state.submitted, 0); assert.equal(active.state.closed, 1);
    assert.deepEqual(result.capturedResponses, []);
  }
});
