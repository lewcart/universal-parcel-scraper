import { Worker } from 'node:worker_threads';

const TARGETS = { bicycles: 'bicycle', bridges: 'bridge', buses: 'bus', cars: 'car', chimneys: 'chimney',
  crosswalks: 'crosswalk', 'fire hydrants': 'hydrant', motorcycles: 'motorcycle', mountains: 'mountain',
  'palm trees': 'palm', stairs: 'stair', tractors: 'tractor', 'traffic lights': 'traffic light',
  'fire hydrant': 'hydrant', 'palm tree': 'palm' };
for (const label of Object.values(TARGETS)) TARGETS[label] = label;
let active = 0;

function targetLabel(value) {
  const target = typeof value === 'string' ? value.trim().toLowerCase().replace(/^(?:a|an)\s+/, '') : '';
  return Object.hasOwn(TARGETS, target) ? TARGETS[target] : null;
}

export function dhlPolandImageAnswers(target, tiles, scores) {
  const label = targetLabel(target);
  if (!label || tiles.length !== 9 || scores.length !== 9) return [];
  return scores.flatMap((score, index) => !tiles[index].selected && score?.label === label
    && Number.isFinite(score.confidence) && score.confidence >= 0.35 && score.confidence <= 1 ? [index] : []);
}

/** Runs in the widget frame. A loaded replacement can still be fading in. */
export function dhlPolandGridReady(previous) {
  const state = () => {
    const tiles = [...document.querySelectorAll('.rc-imageselect-tile')];
    if (!tiles.length) return null;
    const sources = [];
    for (const tile of tiles) {
      const image = tile.querySelector('img');
      if (!image?.complete || image.naturalWidth <= 1 || image.naturalHeight <= 1
        || tile.classList.contains('rc-imageselect-dynamic-selected')) return null;
      // Selected static tiles are not classified again and can remain dimmed.
      const selected = tile.classList.contains('rc-imageselect-tileselected');
      if (!selected && [tile, image].some(element => {
        const style = getComputedStyle(element);
        return Number(style.opacity) !== 1 || style.visibility !== 'visible' || !element.getClientRects().length;
      })) return null;
      sources.push([image.src, selected]);
    }
    if (previous && !previous.indices.every(index => sources[index]?.[0] !== previous.before[index]?.src)) return null;
    return JSON.stringify([document.querySelector('.rc-imageselect-desc-wrapper strong')?.textContent, sources]);
  };
  const signature = state();
  // The replacement URL, loading class and fade do not change atomically.
  // Playwright caches this predicate for one wait and polls it each frame.
  // It treats a returned Promise as truthy, so keep the predicate synchronous.
  const previousState = dhlPolandGridReady.pollState;
  const frames = signature && signature === previousState?.signature ? previousState.frames + 1 : 0;
  dhlPolandGridReady.pollState = { signature, frames };
  return !!signature && frames >= 2;
}

/** Bounded image verification for DHL Poland's English checkbox widget only. */
export async function solveDhlPolandImages(page, maxTimeout, createWorker = () => new Worker(new URL('./dhl-poland-model/worker.mjs', import.meta.url)), report) {
  const started = Date.now();
  let phase = 'widget', reason = 'round_limit';
  const emit = (event, fields = {}) => {
    // All fields below are fixed enums, counts or model scores, never page text,
    // image URLs, tokens or thrown errors. Diagnostics cannot break retrieval.
    try { report?.({ event, elapsedMs: Date.now() - started, ...fields }); } catch { /* Optional observer. */ }
  };
  const finish = value => { reason = value; return value === 'verified'; };
  if (active >= 2 || !Number.isFinite(maxTimeout) || maxTimeout < 1) {
    emit('end', { phase, reason: active >= 2 ? 'worker_busy' : 'invalid_budget' });
    return false;
  }
  active++;
  const deadline = Date.now() + maxTimeout;
  let worker, timer, expired = false, sequence = 0;
  const pending = new Map();
  const left = () => Math.max(1, Math.floor(deadline - Date.now()));
  const verified = () => page.locator('#g-recaptcha-response').inputValue({ timeout: left() }).then(value => value.length > 0, () => false);
  try {
    return await Promise.race([
      (async () => {
        const frames = page.frames();
        const anchor = frames.map(frame => frame.url()).find(value => /^https:\/\/(?:www\.google\.com|www\.recaptcha\.net)\/recaptcha\/(?:api2|enterprise)\/anchor\?/.test(value));
        const key = anchor ? new URL(anchor).searchParams.get('k') : null;
        if (!key || !/^[A-Za-z0-9_-]{20,100}$/.test(key)) return finish('missing_widget');
        const frame = frames.find(item => {
          const value = item.url();
          return /^https:\/\/(?:www\.google\.com|www\.recaptcha\.net)\/recaptcha\/(?:api2|enterprise)\/bframe\?/.test(value)
            && new URL(value).searchParams.get('k') === key;
        });
        if (!frame) return finish('missing_frame');
        phase = 'worker';
        worker = createWorker();
        worker.on('message', message => {
          const job = pending.get(message.id);
          if (!job) return;
          pending.delete(message.id);
          if (Array.isArray(message.scores)) job.resolve(message.scores);
          else { reason = 'inference_failed'; job.reject(new Error('Image inference failed')); }
        });
        worker.on('error', () => { reason = 'worker_error'; for (const job of pending.values()) job.reject(new Error('Image worker failed')); pending.clear(); });
        worker.on('exit', () => { if (!expired) reason = 'worker_stopped'; for (const job of pending.values()) job.reject(new Error('Image worker stopped')); pending.clear(); });
        const infer = (bytes, meta) => new Promise((resolve, reject) => {
          const id = ++sequence;
          pending.set(id, { resolve, reject });
          worker.postMessage({ id, bytes, tiles: meta.tiles, viewportWidth: meta.width });
        });
        let reloads = 0, submissions = 0, rejected = null;
        const generation = meta => JSON.stringify([meta.target, meta.tiles.map(tile => [tile.src, tile.selected])]);
        const refresh = async meta => {
          if (reloads >= 1) return false;
          reloads++;
          phase = 'refresh';
          emit('refresh');
          const before = meta.tiles.map(tile => tile.src);
          await frame.locator('#recaptcha-reload-button').click({ timeout: left() });
          await frame.waitForFunction(previous => [...document.querySelectorAll('.rc-imageselect-tile img')].some((image, i) => image.src !== previous[i]),
            before, { timeout: Math.min(5000, left()) });
          rejected = null;
          return true;
        };
        for (let round = 0; round < 16 && !expired; round++) {
          if (await verified()) return finish('verified');
          phase = 'images_ready';
          await frame.waitForFunction(dhlPolandGridReady, null, { timeout: Math.min(5000, left()) });
          const meta = await frame.evaluate(() => ({
            target: document.querySelector('.rc-imageselect-desc-wrapper strong')?.textContent?.trim().toLowerCase(),
            dynamic: /none left/i.test(document.querySelector('.rc-imageselect-desc-wrapper')?.textContent ?? ''),
            width: document.documentElement.clientWidth,
            tiles: [...document.querySelectorAll('.rc-imageselect-tile')].map(tile => {
              const box = tile.getBoundingClientRect();
              return { src: tile.querySelector('img')?.src, selected: tile.classList.contains('rc-imageselect-tileselected'),
                left: box.left, top: box.top, width: box.width, height: box.height };
            }),
          }));
          emit('grid', { round, target: targetLabel(meta.target) ?? 'unsupported', tiles: meta.tiles.length, dynamic: meta.dynamic,
            selected: meta.tiles.filter(tile => tile.selected).length });
          // Re-running a deterministic model on identical, already-rejected
          // images cannot improve its answer. Use the single refresh allowance.
          if (rejected === generation(meta)) {
            if (!await refresh(meta)) return finish('rejected_unchanged');
            continue;
          }
          if (meta.tiles.length !== 9 || !targetLabel(meta.target)) {
            if (!await refresh(meta)) return finish(meta.tiles.length !== 9 ? 'unsupported_grid' : 'unsupported_target');
            continue;
          }
          phase = 'screenshot';
          const image = await page.locator(`iframe[src*="/bframe"][src*="k=${key}"]`).first().screenshot({ timeout: Math.min(5000, left()) });
          phase = 'inference';
          const scores = await infer(image, meta);
          emit('inference', { scores: scores.slice(0, 9).map(score => ({
            label: Object.values(TARGETS).includes(score?.label) || score?.label === 'other' ? score.label : 'unknown',
            confidence: Number.isFinite(score?.confidence) && score.confidence >= 0 && score.confidence <= 1 ? Math.round(score.confidence * 100) / 100 : null,
          })) });
          if (expired) return false;
          // Images can refresh during inference. Answers belong to one generation.
          const unchanged = await frame.evaluate(previous => {
            const tiles = [...document.querySelectorAll('.rc-imageselect-tile')];
            return document.querySelector('.rc-imageselect-desc-wrapper strong')?.textContent?.trim().toLowerCase() === previous.target
              && tiles.length === previous.tiles.length && tiles.every((tile, i) => tile.querySelector('img')?.src === previous.tiles[i].src
                && tile.classList.contains('rc-imageselect-tileselected') === previous.tiles[i].selected);
          }, meta);
          if (!unchanged) { emit('stale'); continue; }
          const answers = dhlPolandImageAnswers(meta.target, meta.tiles, scores);
          emit('selection', { count: answers.length });
          if (answers.length) {
            phase = 'select';
            for (const index of answers) {
              if (expired) return false;
              const current = await frame.evaluate(({ index, src, target }) =>
                document.querySelectorAll('.rc-imageselect-tile')[index]?.querySelector('img')?.src === src
                && document.querySelector('.rc-imageselect-desc-wrapper strong')?.textContent?.trim().toLowerCase() === target,
              { index, src: meta.tiles[index].src, target: meta.target });
              if (!current) break;
              await frame.locator('.rc-imageselect-tile').nth(index).click({ timeout: left() });
            }
            phase = 'replacement';
            if (meta.dynamic) await frame.waitForFunction(dhlPolandGridReady,
              { before: meta.tiles, indices: answers }, { timeout: Math.min(10000, left()) });
          } else {
            if (++submissions > 4) return finish('submission_limit');
            phase = 'verify';
            await frame.locator('#recaptcha-verify-button').click({ timeout: left() });
            await page.waitForFunction(() => document.querySelector('#g-recaptcha-response')?.value.length > 0,
              null, { timeout: Math.min(3000, left()) }).catch(() => {});
            const accepted = await verified();
            const feedback = accepted ? 'none' : await frame.evaluate(() => {
              for (const [selector, reason] of [
                ['.rc-doscaptcha-header-text', 'provider_block'],
                ['.rc-imageselect-incorrect-response', 'incorrect'],
                ['.rc-imageselect-error-select-more', 'select_more'],
                ['.rc-imageselect-error-dynamic-more', 'dynamic_more'],
                ['.rc-imageselect-error-select-something', 'select_something'],
              ]) {
                const element = document.querySelector(selector);
                if (element && element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden') return reason;
              }
              return 'none';
            });
            emit('verification', { submission: submissions, verified: accepted,
              feedback: ['provider_block', 'incorrect', 'select_more', 'dynamic_more', 'select_something', 'none'].includes(feedback) ? feedback : 'unknown' });
            if (accepted) return finish('verified');
            if (feedback === 'provider_block') return finish('provider_block');
            if (['incorrect', 'select_more', 'dynamic_more', 'select_something'].includes(feedback)) rejected = generation(meta);
          }
        }
        return finish(await verified() ? 'verified' : 'round_limit');
      })(),
      new Promise(resolve => { timer = setTimeout(() => { reason = 'deadline'; expired = true; resolve(false); }, maxTimeout); }),
    ]);
  } catch (error) { if (reason === 'round_limit') reason = error?.name === 'TimeoutError' ? 'phase_timeout' : 'phase_failed'; return false; }
  finally {
    expired = true; clearTimeout(timer);
    for (const job of pending.values()) job.reject(new Error('Image verification ended'));
    pending.clear();
    // Keep closing workers counted until termination actually finishes.
    if (worker) {
      const ended = Promise.resolve(worker.terminate()).then(() => { active--; }, () => { active--; });
      let cleanup;
      await Promise.race([ended, new Promise(resolve => { cleanup = setTimeout(resolve, Math.min(200, left())); })]);
      clearTimeout(cleanup);
    } else active--;
    emit('end', { phase, reason });
  }
}
