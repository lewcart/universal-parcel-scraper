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

/** Bounded image verification for DHL Poland's English checkbox widget only. */
export async function solveDhlPolandImages(page, maxTimeout, createWorker = () => new Worker(new URL('./dhl-poland-model/worker.mjs', import.meta.url))) {
  if (active >= 2 || !Number.isFinite(maxTimeout) || maxTimeout < 1) return false;
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
        if (!key || !/^[A-Za-z0-9_-]{20,100}$/.test(key)) return false;
        const frame = frames.find(item => {
          const value = item.url();
          return /^https:\/\/(?:www\.google\.com|www\.recaptcha\.net)\/recaptcha\/(?:api2|enterprise)\/bframe\?/.test(value)
            && new URL(value).searchParams.get('k') === key;
        });
        if (!frame) return false;
        worker = createWorker();
        worker.on('message', message => {
          const job = pending.get(message.id);
          if (!job) return;
          pending.delete(message.id);
          if (Array.isArray(message.scores)) job.resolve(message.scores); else job.reject(new Error('Image inference failed'));
        });
        worker.on('error', () => { for (const job of pending.values()) job.reject(new Error('Image worker failed')); pending.clear(); });
        worker.on('exit', () => { for (const job of pending.values()) job.reject(new Error('Image worker stopped')); pending.clear(); });
        const infer = (bytes, meta) => new Promise((resolve, reject) => {
          const id = ++sequence;
          pending.set(id, { resolve, reject });
          worker.postMessage({ id, bytes, tiles: meta.tiles, viewportWidth: meta.width });
        });
        let reloads = 0, submissions = 0;
        for (let round = 0; round < 16 && !expired; round++) {
          if (await verified()) return true;
          await frame.waitForFunction(() => {
            const images = [...document.querySelectorAll('#rc-imageselect-target img')];
            return images.length > 0 && images.every(image => image.complete && image.naturalWidth > 0);
          }, null, { timeout: Math.min(5000, left()) });
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
          if (meta.tiles.length !== 9 || !targetLabel(meta.target)) {
            if (reloads++ > 0) return false;
            const before = meta.tiles.map(tile => tile.src);
            await frame.locator('#recaptcha-reload-button').click({ timeout: left() });
            await frame.waitForFunction(previous => [...document.querySelectorAll('.rc-imageselect-tile img')].some((image, i) => image.src !== previous[i]),
              before, { timeout: Math.min(5000, left()) });
            continue;
          }
          const image = await page.locator(`iframe[src*="/bframe"][src*="k=${key}"]`).first().screenshot({ timeout: Math.min(5000, left()) });
          const scores = await infer(image, meta);
          if (expired) return false;
          // Images can refresh during inference. Answers belong to one generation.
          const unchanged = await frame.evaluate(previous => {
            const tiles = [...document.querySelectorAll('.rc-imageselect-tile')];
            return document.querySelector('.rc-imageselect-desc-wrapper strong')?.textContent?.trim().toLowerCase() === previous.target
              && tiles.length === previous.tiles.length && tiles.every((tile, i) => tile.querySelector('img')?.src === previous.tiles[i].src
                && tile.classList.contains('rc-imageselect-tileselected') === previous.tiles[i].selected);
          }, meta);
          if (!unchanged) continue;
          const answers = dhlPolandImageAnswers(meta.target, meta.tiles, scores);
          if (answers.length) {
            for (const index of answers) {
              if (expired) return false;
              const current = await frame.evaluate(({ index, src, target }) =>
                document.querySelectorAll('.rc-imageselect-tile')[index]?.querySelector('img')?.src === src
                && document.querySelector('.rc-imageselect-desc-wrapper strong')?.textContent?.trim().toLowerCase() === target,
              { index, src: meta.tiles[index].src, target: meta.target });
              if (!current) break;
              await frame.locator('.rc-imageselect-tile').nth(index).click({ timeout: left() });
            }
            if (meta.dynamic) await frame.waitForFunction(({ before, indices }) => indices.every(index => {
              const tile = document.querySelectorAll('.rc-imageselect-tile')[index];
              const image = tile?.querySelector('img');
              return image && image.src !== before[index].src && image.complete && image.naturalWidth > 0
                && !tile.classList.contains('rc-imageselect-dynamic-selected');
            }), { before: meta.tiles, indices: answers }, { timeout: Math.min(10000, left()) });
          } else {
            if (++submissions > 4) return false;
            await frame.locator('#recaptcha-verify-button').click({ timeout: left() });
            await page.waitForFunction(() => document.querySelector('#g-recaptcha-response')?.value.length > 0,
              null, { timeout: Math.min(3000, left()) }).catch(() => {});
          }
        }
        return await verified();
      })(),
      new Promise(resolve => { timer = setTimeout(() => { expired = true; resolve(false); }, maxTimeout); }),
    ]);
  } catch { return false; }
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
  }
}
