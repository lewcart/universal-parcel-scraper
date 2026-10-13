import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { dhlPolandImageAnswers, solveDhlPolandImages } from './dhl-poland-images.mjs';

const key = 'SYNTHETIC_SITE_KEY_00000000';
const tile = (src, selected = false) => ({ src, selected, left: 0, top: 0, width: 128, height: 128 });
const initial = () => Array.from({ length: 9 }, (_, i) => tile(`synthetic-image-${i}`));
const scores = matches => Array.from({ length: 9 }, (_, i) => ({ label: matches.includes(i) ? 'bicycle' : 'other', confidence: 0.95 }));
function fixture({ dynamic = false, changed = false, fail = false, stall = false, count = 9 } = {}) {
  const state = { terminated: 0, clicks: [], verify: 0, inferences: 0, reads: 0, solved: false, reloads: 0 };
  let tiles = initial().slice(0, count);
  const frame = {
    url: () => `https://www.google.com/recaptcha/api2/bframe?k=${key}`,
    waitForFunction: async () => {},
    evaluate: async (_fn, previous) => previous ? !changed : { target: 'bicycles', dynamic, width: 400, tiles: structuredClone(tiles) },
    locator: selector => {
      if (selector === '#recaptcha-reload-button') return { click: async () => { state.reloads++; } };
      if (selector === '#recaptcha-verify-button') return { click: async () => { state.verify++; state.solved = true; } };
      return { nth: index => ({ click: async () => {
        state.clicks.push(index);
        if (dynamic) tiles[index].src += '-new'; else tiles[index].selected = true;
      } }) };
    },
  };
  const page = { frames: () => [{ url: () => `https://www.google.com/recaptcha/api2/anchor?k=${key}` }, frame],
    waitForFunction: async () => {}, locator: selector => selector === '#g-recaptcha-response'
      ? { inputValue: async () => state.solved ? 'PRIVATE' : '' }
      : { first: () => ({ screenshot: async () => { state.reads++; return Buffer.from('synthetic image'); } }) },
  };
  const createWorker = () => {
    const worker = new EventEmitter();
    worker.terminate = async () => { state.terminated++; };
    worker.postMessage = ({ id }) => {
      state.inferences++;
      if (stall) return;
      queueMicrotask(() => fail ? worker.emit('error', new Error('PRIVATE'))
        : worker.emit('message', { id, scores: scores(state.inferences === 1 ? [0, 3] : []) }));
    };
    return worker;
  };
  return { state, page, createWorker };
}
test('answers require the supported target, confidence and an unselected current tile', () => {
  const tiles = initial(); tiles[3].selected = true;
  assert.deepEqual(dhlPolandImageAnswers('bicycles', tiles, scores([0, 3])), [0]);
  assert.deepEqual(dhlPolandImageAnswers('unknown', tiles, scores([0])), []);
  assert.deepEqual(dhlPolandImageAnswers('bus', tiles, scores([0]).map(score => ({ ...score, label: score.label === 'bicycle' ? 'bus' : score.label }))), [0]);
  const low = scores([0]); low[0].confidence = 0.1;
  assert.deepEqual(dhlPolandImageAnswers('bicycles', tiles, low), []);
});
test('static and dynamic grids require backend verification and worker cleanup', async () => {
  for (const dynamic of [false, true]) {
    const active = fixture({ dynamic });
    assert.equal(await solveDhlPolandImages(active.page, 1000, active.createWorker), true);
    assert.deepEqual(active.state.clicks, [0, 3]);
    assert.equal(active.state.verify, 1); assert.equal(active.state.terminated, 1);
  }
});
test('answers are discarded if the images changed during inference', async () => {
  const active = fixture({ changed: true });
  assert.equal(await solveDhlPolandImages(active.page, 1000, active.createWorker), false);
  assert.deepEqual(active.state.clicks, []); assert.equal(active.state.verify, 0);
  assert.equal(active.state.inferences, 16); assert.equal(active.state.terminated, 1);
});
test('unsupported grids refresh once and never trigger guesses', async () => {
  const active = fixture({ count: 4 });
  assert.equal(await solveDhlPolandImages(active.page, 1000, active.createWorker), false);
  assert.equal(active.state.reloads, 1); assert.equal(active.state.inferences, 0);
});
test('failed and stalled inference releases the worker without submitting', async () => {
  for (const options of [{ fail: true }, { stall: true }]) {
    const active = fixture(options);
    assert.equal(await solveDhlPolandImages(active.page, 20, active.createWorker), false);
    assert.deepEqual(active.state.clicks, []); assert.equal(active.state.terminated, 1);
  }
});
test('a challenge frame from another widget cannot be solved', async () => {
  const active = fixture(); const frames = active.page.frames();
  frames[1].url = () => 'https://www.google.com/recaptcha/api2/bframe?k=OTHER_SYNTHETIC_KEY_00000000';
  active.page.frames = () => frames;
  assert.equal(await solveDhlPolandImages(active.page, 1000, active.createWorker), false);
  assert.equal(active.state.inferences, 0);
});
test('the model stays outside the core package and the build verifies immutable weights', () => {
  const installer = readFileSync(new URL('./install-dhl-poland-model.mjs', import.meta.url), 'utf8');
  assert.match(installer, /b8049e7243f6f1e6f7d4c6e9e4eb4befc0eaab21/);
  assert.match(installer, /createHash\('sha256'\)/);
  assert.match(installer, /20_402_226/);
  const config = JSON.parse(readFileSync(new URL('./dhl-poland-model/package.json', import.meta.url), 'utf8'));
  assert.equal(config.dependencies['onnxruntime-web'], '1.30.0');
  assert.equal(config.dependencies.sharp, '0.35.5');
});
