import { setTimeout as delay } from 'node:timers/promises';
import { solveSlider } from './zto-slider.mjs';
import { solveZtoCharacters } from './zto-ocr.mjs';

const API = 'https://hdgateway.zto.com/batchGetTrace';
const MAX_BODY = 1_000_000;

export function ztoBrowserNumber(rawUrl, capture = {}) {
  let url;
  try { url = new URL(rawUrl); } catch { return null; }
  const number = url.searchParams.get('waybills') ?? '';
  return url.origin === 'https://www.zto.com' && url.pathname === '/check/detail' && !url.username && !url.password
    && !url.hash && [...url.searchParams].length === 1 && /^(?:\d{12}|7\d{13})$/.test(number)
    && capture.captureResponses?.length === 1 && capture.captureResponses[0] === API ? number : null;
}

/** Keep identity, milestone clocks and failure kinds, never recipient fields or tokens. */
export function projectZtoReply(payload, number) {
  if (!payload || typeof payload !== 'object' || typeof payload.status !== 'boolean') return {};
  const statusCode = typeof payload.statusCode === 'string' && /^[A-Z0-9]{1,20}$/.test(payload.statusCode) ? payload.statusCode : null;
  const result = { status: payload.status, statusCode };
  if (!payload.status) {
    const message = typeof payload.message === 'string' ? payload.message.slice(0, 1000) : '';
    result.message = /频繁|限流|too many|rate limit/i.test(message) ? 'rate limit'
      : /验证码|验证|登录|captcha|verification/i.test(message) ? 'verification' : '';
    return result;
  }
  const items = payload.result?.items;
  if (!Array.isArray(items) || items.length !== 1 || items[0]?.billCode !== number || !Array.isArray(items[0]?.traces)
    || items[0].traces.length > 500) return result;
  const string = value => typeof value === 'string' && value.length <= 200 ? value : null;
  result.result = { items: [{ billCode: number, traces: items[0].traces.map(row => ({
    traceTypeCode: string(row?.traceTypeCode), traceTypeDesc: string(row?.traceTypeDesc),
    traceSiteName: string(row?.traceSiteName), traceTime: typeof row?.traceTime === 'number' ? row.traceTime : null,
  })) }] };
  return result;
}

function widgetState() {
  const root = [...document.querySelectorAll('.dx_captcha')].find(e => e.getBoundingClientRect().width);
  if (!root) return null;
  const rect = root.getBoundingClientRect();
  const pic = root.querySelector('.dx_captcha_clickword_pic');
  const p = pic?.getBoundingClientRect();
  const targets = root.querySelector('.dx_captcha_clickword_hint-cnt')?.textContent?.trim();
  if (p?.width && /^[\u3400-\u9fff]{2,4}$/.test(targets ?? '')) return { type: 'characters', targets,
    key: 'characters:' + targets + ':' + pic.getAttribute('style'),
    box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    region: { x: p.x - rect.x, y: p.y - rect.y, width: p.width, height: p.height } };
  const image = root.querySelector('.dx_captcha_basic_sub-slider img');
  if (root.querySelector('.dx_captcha_basic_bg canvas')?.width && image?.naturalWidth) {
    return { type: 'slider', key: 'slider:' + image.src };
  }
  return null;
}

export async function runZtoBrowser({ url, handle, tier, maxTimeout, capture, installPolicy, signal,
  solveCharacters = solveZtoCharacters }) {
  const number = ztoBrowserNumber(url, capture);
  if (!number) return undefined;
  const start = Date.now(), abort = new AbortController();
  const combined = signal ? AbortSignal.any([signal, abort.signal]) : abort.signal;
  let context, page, onResponse, timer, terminal = false, accepting = true, statusCode = 0, bytesRead = 0;
  const entries = [], attempted = new Set();
  const remaining = () => Math.max(1, Math.floor(maxTimeout - (Date.now() - start)));
  const result = () => ({ tier, status: 'success', durationMs: Date.now() - start, effectiveUrl: url,
    html: '', body: new Uint8Array(), statusCode, cookies: [], capturedResponses: entries });
  const close = async target => {
    let closed = false, cleanup;
    try { await Promise.race([
      Promise.resolve().then(() => target.close()).then(() => { closed = true; }).catch(() => {}),
      new Promise(resolve => { cleanup = setTimeout(resolve, 1500); }),
    ]); } finally { clearTimeout(cleanup); if (!closed) handle.requestBrowserReplacement?.('ZTO context cleanup failed'); }
  };
  let rejectAbort;
  const interrupted = new Promise((_, reject) => { rejectAbort = () => reject(new Error('ZTO browser interrupted')); });
  try {
    if (!Number.isFinite(maxTimeout) || maxTimeout < 1) throw new Error('No browser budget');
    combined.throwIfAborted();
    combined.addEventListener('abort', rejectAbort, { once: true });
    timer = setTimeout(() => abort.abort(), maxTimeout);
    return await Promise.race([interrupted, (async () => {
      const created = await handle.browser.newContext();
      handle.noteTemporaryContext?.();
      if (combined.aborted) { await close(created); return result(); }
      context = created;
      page = await context.newPage();
      combined.throwIfAborted();
      await installPolicy?.(page);
      combined.throwIfAborted();
      // Synchronous Baidu telemetry can hold the document parser in <head>,
      // before the tracking client starts. Keep this filter local to ZTO.
      await page.route(/^https:\/\/(?:hm|dlswbr)\.baidu\.com\//, route => route.abort('blockedbyclient'));
      onResponse = response => {
        if (!accepting || response.url() !== API || response.request().method() !== 'POST') return;
        let request;
        try { request = response.request().postDataJSON(); } catch { return; }
        if (request?.items?.length !== 1 || request.items[0]?.billCode !== number) return;
        if (entries.length >= 10) { entries.at(-1).error = 'ZTO response limit exceeded'; terminal = true; return; }
        const headers = response.headers();
        const entry = { url: API, trackingNumberSubmitted: number, status: response.status(), body: null,
          headers: Object.fromEntries(['content-type', 'retry-after'].filter(key => headers[key]).map(key => [key, headers[key].slice(0, 100)])),
          truncated: false, base64Encoded: false, error: null };
        entries.push(entry);
        if (entry.status !== 200) { terminal = true; return; }
        const length = Number(headers['content-length'] ?? 0);
        if (!Number.isSafeInteger(length) || length < 0 || length > MAX_BODY || bytesRead >= MAX_BODY * 3) {
          entry.truncated = true; terminal = true; return;
        }
        void response.body().then(body => {
          if (!accepting) return;
          bytesRead += body.length;
          if (body.length > MAX_BODY || bytesRead > MAX_BODY * 3) { entry.truncated = true; terminal = true; return; }
          const payload = projectZtoReply(JSON.parse(body.toString('utf8')), number);
          entry.body = JSON.stringify(payload);
          // Keep the initial challenge through escalation and automatic retries.
          if (payload.status !== false || !['10201', '10202'].includes(payload.statusCode)) terminal = true;
        }).catch(() => { if (accepting) { entry.error = 'ZTO response could not be read'; terminal = true; } });
      };
      page.on('response', onResponse);
      const navigation = await page.goto(url, { waitUntil: 'commit', timeout: Math.min(15000, remaining()) });
      statusCode = navigation?.status() ?? 0;
      for (let actions = 0; !terminal && !combined.aborted && remaining() > 1500;) {
        const state = await page.evaluate(widgetState);
        if (!state || attempted.has(state.key)) { await delay(200, undefined, { signal: combined }); continue; }
        if (++actions > 4) break;
        attempted.add(state.key);
        if (state.type === 'slider') {
          const solution = await page.evaluate(solveSlider);
          if (solution.error || solution.score < 0.5 || !Number.isFinite(solution.distance) || solution.distance <= 0) break;
          await page.evaluate(async s => {
            const element = document.querySelector('.dx_captcha_basic_slider');
            if (!element) return;
            const { x, y } = s.start;
            const emit = (type, a, b) => element.dispatchEvent(new MouseEvent(type,
              { bubbles: true, clientX: a, clientY: b, button: 0, buttons: type === 'mouseup' ? 0 : 1 }));
            emit('mousedown', x, y);
            for (let i = 1; i <= 40; i++) {
              await new Promise(resolve => setTimeout(resolve, 25));
              emit('mousemove', x + s.distance * (1 - Math.pow(1 - i / 40, 2)), y + Math.sin(i / 7) * 2);
            }
            emit('mouseup', x + s.distance, y);
          }, solution);
        } else {
          if (remaining() < 5000 || state.box.width > 600 || state.box.height > 400) break;
          const image = await page.locator('.dx_captcha_clickword:visible').screenshot({ timeout: Math.min(2000, remaining()), scale: 'css' });
          if (image.length > MAX_BODY) break;
          const points = await solveCharacters({ image: image.toString('base64'), targets: state.targets, region: state.region }, combined, remaining() - 2000);
          if (!Array.isArray(points) || points.length !== [...state.targets].length || combined.aborted) break;
          const current = await page.evaluate(widgetState);
          if (current?.key !== state.key) continue;
          for (const point of points) {
            if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || point.x < state.region.x || point.y < state.region.y
              || point.x > state.region.x + state.region.width || point.y > state.region.y + state.region.height) throw new Error('Invalid character position');
            combined.throwIfAborted();
            await page.evaluate(({ x, y }) => {
              const element = document.elementFromPoint(x, y);
              if (!element?.closest('.dx_captcha_clickword')) return;
              for (const type of ['mousemove', 'mousedown', 'mouseup', 'click']) element.dispatchEvent(new MouseEvent(type,
                { bubbles: true, clientX: x, clientY: y, button: 0, buttons: type === 'mousedown' ? 1 : 0 }));
            }, { x: current.box.x + point.x, y: current.box.y + point.y });
            await delay(250, undefined, { signal: combined });
          }
        }
        await delay(600, undefined, { signal: combined });
      }
      return result();
    })()]);
  } catch {
    if (entries.length) return result();
    return { tier, status: 'error', durationMs: Date.now() - start,
      reason: combined.aborted ? 'ZTO browser budget exhausted' : 'ZTO browser retrieval failed' };
  } finally {
    accepting = false; clearTimeout(timer);
    combined.removeEventListener('abort', rejectAbort); abort.abort();
    if (page && onResponse) page.off('response', onResponse);
    if (context) await close(context);
  }
}
