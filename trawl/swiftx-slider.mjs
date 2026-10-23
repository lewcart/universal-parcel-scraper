import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const API = 'https://swiftx-express.com/api/graphql';
const MAX_IMAGE = 1_500_000;
let active = 0;

/** Disposable image analysis, with no number, session or verification token. */
export function locateSwiftxSlider(challenge, signal, timeoutMs) {
  if (signal.aborted || timeoutMs < 100 || active >= 2) return Promise.resolve(null);
  active++;
  return new Promise(resolve => {
    let output = '', invalid = false;
    const child = spawn('/opt/zto-ocr/bin/python', [fileURLToPath(new URL('./swiftx-slider.py', import.meta.url))],
      { stdio: ['pipe', 'pipe', 'ignore'], env: { PATH: process.env.PATH ?? '', OMP_NUM_THREADS: '1', OPENBLAS_NUM_THREADS: '1' } });
    const stop = () => { invalid = true; child.kill('SIGKILL'); };
    const timer = setTimeout(stop, Math.min(4000, timeoutMs));
    signal.addEventListener('abort', stop, { once: true });
    child.stdout.on('data', data => { output += data.toString(); if (output.length > 512) stop(); });
    child.stdin.on('error', () => {});
    child.on('error', () => { invalid = true; });
    child.on('close', code => {
      clearTimeout(timer); signal.removeEventListener('abort', stop); active--;
      try {
        const answer = !invalid && code === 0 ? JSON.parse(output) : null;
        if (challenge.type === 'ICON_CLICK') {
          const points = answer?.points;
          resolve(Array.isArray(points) && Number.isInteger(challenge.clickCount) && challenge.clickCount >= 2
            && challenge.clickCount <= 6 && points.length === challenge.clickCount
            && points.every(point => Number.isInteger(point?.x) && Number.isInteger(point?.y)
              && point.x > 0 && point.x < challenge.backgroundImageWidth && point.y > 0 && point.y < challenge.backgroundImageHeight)
            ? { points: points.map(({ x, y }) => ({ x, y })) } : null);
          return;
        }
        const maximum = ['CONCAT', 'ROTATE'].includes(challenge.type) ? challenge.backgroundImageWidth
          : challenge.backgroundImageWidth - challenge.templateImageWidth;
        resolve(Number.isInteger(answer?.x) && answer.x >= 0 && answer.x < maximum ? answer : null);
      } catch { resolve(null); }
    });
    if (signal.aborted) stop();
    else child.stdin.end(JSON.stringify(Object.fromEntries(['type', 'backgroundImage', 'templateImage',
      'backgroundImageWidth', 'backgroundImageHeight', 'templateImageWidth', 'templateImageHeight', 'concatTopHeight', 'clickCount']
      .map(key => [key, challenge[key]]))));
  });
}

function validChallenge(value) {
  const image = text => typeof text === 'string' && text.length <= MAX_IMAGE
    && /^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(text);
  return value?.success === true && typeof value.captchaId === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value.captchaId)
    && typeof value.type === 'string' && ['SLIDER', 'ROTATE', 'CONCAT', 'ICON_CLICK'].includes(value.type)
    && image(value.backgroundImage) && (value.templateImage == null || image(value.templateImage))
    && Number.isInteger(value.backgroundImageWidth) && value.backgroundImageWidth >= 32 && value.backgroundImageWidth <= 1024
    && Number.isInteger(value.backgroundImageHeight) && value.backgroundImageHeight >= 32 && value.backgroundImageHeight <= 1024;
}

/** The page's own image and slider geometry; a refreshed puzzle cannot use an old plan. */
export function swiftxSliderGeometry({ number, challenge }) {
  const url = new URL(location.href);
  if (url.origin !== 'https://swiftx-express.com' || url.pathname !== '/track'
    || url.searchParams.getAll('trackingNumber').length !== 1 || url.searchParams.get('trackingNumber') !== number) return null;
  const entered = [...document.querySelectorAll('textarea')];
  if (entered.length && !entered.some(input => input.value.trim().toUpperCase() === number)) return null;
  const dialog = document.querySelector('[role="dialog"]');
  if (!dialog) return null;
  const images = [...dialog.querySelectorAll('img')];
  const background = images.find(image => image.src === challenge.backgroundImage);
  const template = images.find(image => image.src === challenge.templateImage);
  if (!background?.complete || !background.naturalWidth) return null;
  const bg = background.getBoundingClientRect();
  if (bg.width < 100 || bg.height <= 0 || background.naturalWidth !== challenge.backgroundImageWidth
    || background.naturalHeight !== challenge.backgroundImageHeight) return null;
  if (challenge.type === 'ICON_CLICK') {
    if (!template?.complete || template.naturalWidth !== challenge.templateImageWidth
      || template.naturalHeight !== challenge.templateImageHeight) return null;
    return { x: bg.x, y: bg.y, scaleX: bg.width / background.naturalWidth,
      scaleY: bg.height / background.naturalHeight, width: bg.width, height: bg.height };
  }
  const knob = [...dialog.querySelectorAll('button')].find(button => button.style.width === '44px'
    && button.style.height === '44px' && !button.disabled);
  if (!knob) return null;
  const handle = knob.getBoundingClientRect();
  if (handle.width !== 44) return null;
  let maxImage = bg.width;
  if (['SLIDER', 'ROTATE'].includes(challenge.type)) {
    if (!template?.complete || !template.naturalWidth || template.naturalWidth !== challenge.templateImageWidth
      || template.naturalHeight !== challenge.templateImageHeight) return null;
    const piece = template.getBoundingClientRect();
    if (piece.width <= 0 || piece.width >= bg.width) return null;
    if (challenge.type === 'SLIDER') maxImage -= piece.width;
  } else if (challenge.type === 'CONCAT') {
    if (![...dialog.querySelectorAll('div')].some(element => element.style.backgroundImage.includes(challenge.backgroundImage)
      && Math.abs(element.getBoundingClientRect().height - challenge.concatTopHeight * bg.width / background.naturalWidth) <= 1)) return null;
  } else return null;
  return { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2,
    scale: bg.width / background.naturalWidth, maxKnob: bg.width - handle.width, maxImage };
}

export function swiftxSliderDrag(geometry, plan) {
  if (!geometry || !Number.isInteger(plan?.x) || !['x', 'y', 'scale', 'maxKnob', 'maxImage'].every(key => Number.isFinite(geometry[key]))
    || geometry.scale <= 0 || geometry.maxKnob <= 0 || geometry.maxImage <= 0) return null;
  const distance = plan.x * geometry.scale * geometry.maxKnob / geometry.maxImage;
  return Number.isFinite(distance) && distance >= 8 && distance <= geometry.maxKnob
    ? { x: geometry.x, y: geometry.y, distance } : null;
}

export function swiftxIconClicks(geometry, plan, count) {
  if (!geometry || !Number.isInteger(count) || count < 2 || count > 6 || !Array.isArray(plan?.points)
    || plan.points.length !== count || !['x', 'y', 'scaleX', 'scaleY', 'width', 'height'].every(key => Number.isFinite(geometry[key]))
    || geometry.scaleX <= 0 || geometry.scaleY <= 0 || geometry.width <= 0 || geometry.height <= 0) return null;
  const points = plan.points.map(point => ({ x: point?.x * geometry.scaleX, y: point?.y * geometry.scaleY }));
  if (points.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y)
    || point.x <= 0 || point.x >= geometry.width || point.y <= 0 || point.y >= geometry.height)
    || new Set(points.map(point => `${point.x},${point.y}`)).size !== count) return null;
  return points.map(point => ({ x: geometry.x + point.x, y: geometry.y + point.y }));
}

/** Observe before navigation; only the official UI obtains and submits verification. */
export function attachSwiftxSlider(page, number, { signal: parent, solve = locateSwiftxSlider } = {}) {
  const stopped = new AbortController();
  const signal = parent ? AbortSignal.any([parent, stopped.signal]) : stopped.signal;
  const digest = createHash('sha256').update(number).digest('hex');
  let current, generation = 0, verified = false, refusal, disposed = false, reads = 0;
  let deadline = 0, attempted = 0, seen = 0, running, hasRequest = () => false, onRefusal;
  const remaining = () => Math.max(0, deadline - Date.now());
  const refused = value => { refusal = value; onRefusal?.(value); };
  const pending = new Set();
  const onResponse = response => {
    if (disposed || signal.aborted || response.url() !== API || response.request().method() !== 'POST') return;
    if (response.request().frame && response.request().frame() !== page.mainFrame()) return;
    let request;
    try { request = response.request().postDataJSON(); } catch { return; }
    const query = request?.query;
    if (typeof query !== 'string') return;
    const image = /\bgetOfficialTrackingSliderCaptcha\b/.test(query);
    const verification = /\bverifyOfficialTrackingSlider\b/.test(query) && current
      && request.variables?.input?.captchaId === current.captchaId && request.variables?.input?.bindingDigest === digest;
    if (!image && !verification) return;
    const status = response.status(), headers = response.headers();
    if (status !== 200) {
      if (status >= 400) refused({ status, retryAfter: headers['retry-after'] });
      return;
    }
    const length = Number(headers['content-length'] ?? 0);
    if (++reads > 6 || !String(headers['content-type'] ?? '').includes('application/json')
      || !Number.isSafeInteger(length) || length < 0 || length > 3_100_000) return;
    const read = response.body().then(body => {
      if (disposed || signal.aborted || body.length > 3_100_000) return;
      let payload;
      try { payload = JSON.parse(body.toString('utf8'))?.data; } catch { return; }
      if (image) {
        const challenge = payload?.getOfficialTrackingSliderCaptcha;
        if (challenge?.errorCode === 'SLIDER_FETCH_RATE_LIMITED') refused({ status: 429 });
        if (validChallenge(challenge)) {
          current = Object.fromEntries(['captchaId', 'type', 'backgroundImage', 'templateImage', 'backgroundImageWidth',
            'backgroundImageHeight', 'templateImageWidth', 'templateImageHeight', 'concatTopHeight', 'clickCount']
            .map(key => [key, challenge[key]]));
          generation++; verified = false; startDrive();
        }
      } else {
        const result = payload?.verifyOfficialTrackingSlider;
        // The issued token is consumed by the page's callback and never returned.
        verified = result?.success === true && typeof result.sliderToken === 'string' && result.sliderToken.length > 0;
      }
    }).catch(() => {}).finally(() => pending.delete(read));
    pending.add(read);
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true; stopped.abort(); current = undefined;
    page.off('response', onResponse); page.off('close', dispose);
  };
  page.on('response', onResponse); page.on('close', dispose);
  function startDrive() {
    if (!running && current && remaining() > 3500 && !disposed && !signal.aborted && !refusal) {
      running = drive().catch(() => {}).finally(() => { running = undefined; });
    }
  }
  async function drive() {
    const pause = () => new Promise(resolve => setTimeout(resolve, Math.min(100, remaining())));
    while (!disposed && !signal.aborted && remaining() > 0 && !hasRequest() && !verified && !refusal) {
      if (!current || generation === seen) { await pause(); continue; }
      if (attempted >= 2 || remaining() < 3500) break;
      seen = generation; attempted++;
      const challenge = current;
      const plan = await solve(challenge, signal, remaining());
      if (disposed || signal.aborted || remaining() < 2000 || current !== challenge) continue;
      const geometry = plan && await page.evaluate(swiftxSliderGeometry, { number, challenge });
      const drag = swiftxSliderDrag(geometry, plan);
      const clicks = challenge.type === 'ICON_CLICK' && swiftxIconClicks(geometry, plan, challenge.clickCount);
      if (!drag && !clicks) {
        if (attempted >= 2 || remaining() < 5000) break;
        await page.getByRole('dialog').locator('button').first().evaluate(button => button.click());
        continue;
      }
      if (clicks) {
        for (const point of clicks) {
          if (disposed || signal.aborted || remaining() < 1000 || current !== challenge
            || !await page.evaluate(swiftxSliderGeometry, { number, challenge })) break;
          await page.mouse.click(point.x, point.y);
        }
        continue;
      }
      await page.mouse.move(drag.x, drag.y);
      if (signal.aborted || remaining() < 1500) break;
      if (current !== challenge || !await page.evaluate(swiftxSliderGeometry, { number, challenge })) continue;
      await page.mouse.down();
      try {
        await page.mouse.move(drag.x + drag.distance / 2, drag.y + .6);
        if (signal.aborted || !remaining()) break;
        await page.mouse.move(drag.x + drag.distance, drag.y);
      } finally { if (!signal.aborted) await page.mouse.up(); }
    }
  }
  return { dispose,
    async prepare(budgetMs, requested = () => false, retainRefusal) {
      deadline = Date.now() + Math.max(0, budgetMs - 1000);
      hasRequest = requested; onRefusal = retainRefusal;
      if (refusal) { onRefusal?.(refusal); return refusal; }
      // Do not delay the generic Turnstile solver while the page still uses it.
      // If it later offers its image dialog, the observer starts the scoped
      // solver while capture continues to wait for the tracking request.
      startDrive();
      if (running) await running;
      return refusal;
    },
  };
}
