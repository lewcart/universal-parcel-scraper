import { test } from 'node:test';
import assert from 'node:assert/strict';
import { magyarPostaAppReply, magyarPostaAppRequest, runMagyarPostaApp } from './magyar-posta-app.mjs';

const number = 'PNZZZ00000013';
const applicationId = '0a1b2c3d-0000-4000-8000-00000000000e';
const endpoint = 'https://net.posta.hu/mpl/public/api/mobile/guest/package/tracking';
const url = `${endpoint}?applicationId=${applicationId}&packageId=${number}`;
const capture = { captureResponses: [endpoint] };
const widget = 'https://net.posta.hu/';
const challenge = 'https://www.google.com/recaptcha/enterprise/bframe?hl=hu&v=PRIVATE&k=PRIVATE';
const clip = n => `https://www.google.com/recaptcha/enterprise/payload?p=PRIVATE${n}&k=PRIVATE`;
const reply = { data: [{ package_id: number, custom_name: 'PRIVATE', sender_name: 'PRIVATE', addressee_name: 'PRIVATE',
  payment: { PRIVATE: 1 }, current_status: 5, consignment_type: 'package', consignment_direction: 'national', delivery_type_key: 'home_delivery',
  package_details: { consignment_title: 'Üzleti csomag', base_service_code: 'A_175_UZL', cod_value: 'PRIVATE' },
  delivery_info: { alias: 'Sikeresen kézbesítve', text: 'Sikeresen kézbesítve háznál', phone_number: 'PRIVATE' },
  events: [{ alias: 'Sikeresen kézbesítve', status: 'Kézbesített', message: 'Sikeresen kézbesítve háznál', code: 'KEZB',
    location: 'Példavárosi Operatív Osztály|Példaváros', date: '2026-03-03T12:20:14.000000Z', extra: 'PRIVATE' }] }] };

/** Runs `fn` against a stub document, as `evaluate` does in the page or frame. */
function within(document, fn) {
  const saved = [globalThis.document, globalThis.getComputedStyle];
  Object.assign(globalThis, { document, getComputedStyle: () => ({ visibility: 'visible' }) });
  try { return fn(); } finally { [globalThis.document, globalThis.getComputedStyle] = saved; }
}

/** The widget page and Google's challenge frame, which react to the helper's clicks as `on` says. */
function fixture({ verdict = 'accept', passive = false, blockedAtAudio = false, status = 200, body = JSON.stringify(reply) } = {}) {
  const state = { closed: 0, policy: 0, routes: [], visited: [], clicks: [], fills: [], clips: 0, heard: [], posts: [],
    token: '', prompt: !passive, audio: '', error: '', blocked: false, audioMode: false };
  const shown = (visible, text = '') => visible ? { getClientRects: () => [{}], textContent: text } : null;
  const frameDocument = { querySelector: selector => {
    if (selector.includes('rc-doscaptcha')) return shown(state.blocked, 'PRIVATE');
    if (selector === '.rc-audiochallenge-error-message') return { getClientRects: () => state.error ? [{}] : [], textContent: state.error };
    if (selector === '#audio-source') return state.audio ? { src: state.audio, getAttribute: () => state.audio } : null;
    if (selector === '.rc-imageselect-desc-wrapper') return state.prompt ? { textContent: 'Válassza ki az összes képet' } : null;
    if (selector === '#rc-audio') return shown(state.audioMode);
    return null;
  } };
  const clicks = {
    '#recaptcha-audio-button': () => {
      if (blockedAtAudio) { state.blocked = true; return; }
      state.audioMode = true; state.prompt = false; state.audio = clip(1);
    },
    '#recaptcha-verify-button': () => {
      if (verdict === 'accept') state.token = 'PRIVATE-TOKEN';
      if (verdict === 'refuse') { state.error = 'Több helyes megoldást kell megadni. PRIVATE'; state.audio = clip(2); }
      if (verdict === 'block') state.blocked = true;
    },
    '#recaptcha-reload-button': () => { state.audio = clip(state.clicks.length); if (verdict === 'second') state.verdict = 'accept'; },
  };
  const frame = { url: () => challenge, evaluate: async fn => within(frameDocument, fn),
    locator: selector => ({ click: async () => { state.clicks.push(selector); clicks[selector]?.(); },
      fill: async value => { state.fills.push([selector, value]); } }) };
  if (verdict === 'second') {
    clicks['#recaptcha-verify-button'] = () => { if (state.verdict === 'accept') state.token = 'PRIVATE-TOKEN'; };
  }
  const tab = {
    route: async (pattern, handler) => { state.routes.push(pattern); state.route = handler; },
    goto: async target => {
      state.visited.push(target);
      let fulfilled;
      await state.route({ fulfill: async page => { fulfilled = page; } });
      state.page = fulfilled;
      if (passive) state.token = 'PRIVATE-TOKEN';
      return { status: () => fulfilled ? 200 : 0 };
    },
    frames: () => [{ url: () => challenge.replace('bframe', 'anchor'), evaluate: async () => ({ refused: true }) }, frame],
    evaluate: async fn => within({ getElementById: id => id === 'verification' ? { value: state.token } : null }, fn),
  };
  const context = { newPage: async () => tab, close: async () => { state.closed++; },
    request: { get: async address => { state.clips++; state.heard.push(address); return { status: () => 200, body: async () => Buffer.from('synthetic audio') }; } } };
  const options = { url, capture, tier: 3, maxTimeout: 20000,
    handle: { browser: { newContext: async () => context } },
    installPolicy: async () => { state.policy++; },
    transcribe: async audio => { assert.match(audio, /^data:audio\/mpeg;base64,/); return ' synthetic words '; },
    fetcher: async (target, init) => {
      state.posts.push({ target, init });
      return new Response(body, { status, headers: { 'content-type': 'application/json', 'retry-after': '30' } });
    },
  };
  return { options, state, tab, context };
}

test('accepts only an addition of one whole number under one application id, for the exact endpoint', () => {
  assert.deepEqual(magyarPostaAppRequest(url, capture), { applicationId, number });
  for (const candidate of [url + '#extra', url + '&packageId=' + number, url.replace(number, 'PNZZZ'), url.replace(number, number.toLowerCase()),
    url.replace(applicationId, 'PRIVATE'), url.replace(applicationId, applicationId.toUpperCase()), url.replace('net.posta.hu', 'example.test'),
    url.replace('net.posta.hu', 'user@net.posta.hu'), url.replace('/package/tracking', '/package/trackings'), `${endpoint}?packageId=${number}`]) {
    assert.equal(magyarPostaAppRequest(candidate, capture), null, candidate);
  }
  assert.equal(magyarPostaAppRequest(url, { captureResponses: [endpoint + '?extra'] }), null);
  assert.equal(magyarPostaAppRequest(url, { captureResponses: [endpoint, widget] }), null);
});

test('answers the widget by audio and posts the number with its token, keeping the reply without personal data', async () => {
  const active = fixture();
  const result = await runMagyarPostaApp(active.options);
  assert.deepEqual(active.state.visited, [widget]); assert.deepEqual(active.state.routes, [widget]);
  assert.match(active.state.page.body, /enterprise\.js\?hl=hu/); assert.match(active.state.page.body, /size: "invisible"/);
  assert.deepEqual(active.state.clicks, ['#recaptcha-audio-button', '#recaptcha-verify-button']);
  assert.deepEqual(active.state.fills, [['#audio-response', 'synthetic words']]);
  assert.equal(active.state.clips, 1);
  const [{ target, init }] = active.state.posts;
  const posted = new URL(target);
  assert.equal(posted.origin + posted.pathname, endpoint);
  assert.equal(posted.searchParams.get('applicationId'), applicationId);
  assert.deepEqual(JSON.parse(init.body), { packageId: number, 'g-recaptcha-response': 'PRIVATE-TOKEN' });
  assert.equal(init.method, 'POST'); assert.equal(init.headers.preview, 'true'); assert.ok(init.headers['X-Internal-Key']);
  assert.deepEqual(result.capturedResponses.map(row => [row.url, row.status, row.trackingNumberSubmitted, row.error]),
    [[endpoint, 200, number, null]]);
  const kept = JSON.parse(result.capturedResponses[0].body);
  assert.equal(kept.data[0].events[0].date, '2026-03-03T12:20:14.000000Z');
  assert.equal(kept.data[0].package_details.consignment_title, 'Üzleti csomag');
  assert.equal(JSON.stringify(result).includes('PRIVATE'), false);
  assert.equal(result.status, 'success'); assert.equal(result.html, ''); assert.equal(active.state.closed, 1); assert.equal(active.state.policy, 1);
});

test('posts at once when the widget passes without a challenge, and retries an answer Google does not judge', async () => {
  const passive = fixture({ passive: true });
  const result = await runMagyarPostaApp(passive.options);
  assert.deepEqual(passive.state.clicks, []); assert.equal(passive.state.clips, 0);
  assert.equal(result.capturedResponses[0].trackingNumberSubmitted, number);

  const second = fixture({ verdict: 'second' });
  const answered = await runMagyarPostaApp(second.options);
  assert.deepEqual(second.state.clicks, ['#recaptcha-audio-button', '#recaptcha-verify-button', '#recaptcha-reload-button', '#recaptcha-verify-button']);
  assert.equal(second.state.clips, 2); assert.equal(answered.capturedResponses.at(-1).status, 200);
});

test('ends as a challenge once Google refuses the answer or the address, without another audio request', async () => {
  for (const setup of [{ verdict: 'refuse' }, { verdict: 'block' }, { blockedAtAudio: true }]) {
    const refused = fixture(setup);
    const started = Date.now();
    const result = await runMagyarPostaApp(refused.options);
    assert.ok(Date.now() - started < 2000, JSON.stringify(setup));
    assert.deepEqual(result.capturedResponses.map(row => [row.url, row.status, row.body, row.error]),
      [[widget, 200, null, 'Google refused the audio challenge']]);
    assert.equal(refused.state.clips, setup.blockedAtAudio ? 0 : 1); assert.deepEqual(refused.state.posts, []);
    assert.equal(refused.state.closed, 1); assert.equal(JSON.stringify(result).includes('PRIVATE'), false);
  }
});

test('keeps the app\'s refusals and failures for the adapter, bounded', async () => {
  for (const [status, body] of [[502, '{"status":"error","message":"Unsuccessful Action!"}'], [401, '{"message":"Unsuccessful Action!"}'], [429, '']]) {
    const failed = fixture({ status, body });
    const [row] = (await runMagyarPostaApp(failed.options)).capturedResponses;
    assert.equal(row.status, status); assert.equal(row.trackingNumberSubmitted, number);
    if (status === 429) assert.equal(row.headers['retry-after'], '30');
    else assert.equal(JSON.parse(row.body).message, 'Unsuccessful Action!');
  }
  const html = fixture({ body: '<html>PRIVATE</html>' });
  assert.deepEqual((await runMagyarPostaApp(html.options)).capturedResponses.map(row => [row.body, row.error]),
    [[null, 'Magyar Posta app reply is not JSON']]);
  const large = fixture({ body: JSON.stringify({ data: [], message: 'x'.repeat(1_000_001) }) });
  assert.equal((await runMagyarPostaApp(large.options)).capturedResponses[0].truncated, true);
  const broken = fixture(); broken.options.fetcher = async () => { throw new Error('PRIVATE'); };
  assert.deepEqual((await runMagyarPostaApp(broken.options)).capturedResponses.map(row => row.error), ['Magyar Posta app request failed']);
});

test('ends a widget that never answers before the browser deadline, and needs speech-to-text', async () => {
  const stuck = fixture(); stuck.options.maxTimeout = 9000;
  stuck.tab.frames = () => [];
  const result = await runMagyarPostaApp(stuck.options);
  assert.equal(result.status, 'success'); assert.deepEqual(result.capturedResponses, []);
  assert.ok(result.durationMs < 8500); assert.deepEqual(stuck.state.posts, []); assert.equal(stuck.state.closed, 1);

  const late = fixture(); late.options.maxTimeout = 50;
  late.tab.goto = () => new Promise(() => {});
  assert.equal((await runMagyarPostaApp(late.options)).status, 'error'); assert.equal(late.state.closed, 1);

  const deaf = fixture(); delete deaf.options.transcribe;
  assert.equal((await runMagyarPostaApp(deaf.options)).status, 'error');
  assert.equal(await runMagyarPostaApp({ ...fixture().options, url: url.replace(number, 'PNZZZ') }), undefined);
});

test('keeps only the reply\'s tracking fields', () => {
  const kept = JSON.parse(magyarPostaAppReply(JSON.stringify(reply)));
  assert.deepEqual(Object.keys(kept.data[0]).sort(), ['consignment_direction', 'consignment_type', 'current_status', 'delivery_info',
    'delivery_type_key', 'events', 'package_details', 'package_id']);
  assert.deepEqual(kept.data[0].delivery_info, { alias: 'Sikeresen kézbesítve', text: 'Sikeresen kézbesítve háznál' });
  assert.deepEqual(Object.keys(kept.data[0].events[0]).sort(), ['alias', 'code', 'date', 'location', 'message', 'status']);
  for (const text of ['not json', '[]', 'null', '"text"']) assert.equal(magyarPostaAppReply(text), null);
  assert.deepEqual(JSON.parse(magyarPostaAppReply('{"data":[null,{"package_id":7,"events":"x"}]}')),
    { data: [{ package_id: 7, package_details: {}, delivery_info: {}, events: [] }] });
});
