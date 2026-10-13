import { parentPort } from 'node:worker_threads';
import { readFile } from 'node:fs/promises';
import * as ort from 'onnxruntime-web';
import sharp from 'sharp';

const LABELS = ['bicycle', 'bridge', 'bus', 'car', 'chimney', 'crosswalk', 'hydrant',
  'motorcycle', 'mountain', 'other', 'palm', 'stair', 'tractor', 'traffic light'];
ort.env.wasm.numThreads = 1;
let session;

async function classify(bytes, tiles, viewportWidth) {
  if (!(bytes instanceof Uint8Array) || bytes.length > 1_000_000 || !bytes.length
    || !Array.isArray(tiles) || tiles.length !== 9 || !Number.isFinite(viewportWidth) || viewportWidth < 100) throw new Error('Invalid image');
  const image = sharp(bytes, { limitInputPixels: 1_000_000, pages: 1, failOn: 'warning' });
  const meta = await image.metadata();
  if (meta.format !== 'png' || !meta.width || !meta.height || meta.width > 1024 || meta.height > 1024) throw new Error('Invalid image');
  const scale = meta.width / viewportWidth;
  session ??= await ort.InferenceSession.create(new Uint8Array(await readFile(new URL('./classifier.onnx', import.meta.url))),
    { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
  const scores = [];
  for (const tile of tiles) {
    const region = { left: Math.round(tile.left * scale), top: Math.round(tile.top * scale),
      width: Math.floor(tile.width * scale), height: Math.floor(tile.height * scale) };
    if (!Object.values(region).every(Number.isSafeInteger) || region.left < 0 || region.top < 0 || region.width < 20 || region.height < 20
      || region.left + region.width > meta.width || region.top + region.height > meta.height) throw new Error('Invalid image region');
    const pixels = await image.clone().extract(region).resize(128, 128, { kernel: 'linear' }).removeAlpha().raw().toBuffer();
    if (pixels.length !== 128 * 128 * 3) throw new Error('Invalid pixels');
    const input = new Float32Array(3 * 128 * 128);
    for (let p = 0; p < 128 * 128; p++) for (let c = 0; c < 3; c++) input[c * 128 * 128 + p] = pixels[p * 3 + c] / 255;
    const output = (await session.run({ images: new ort.Tensor('float32', input, [1, 3, 128, 128]) })).output0;
    if (!output || output.type !== 'float32' || output.data.length !== LABELS.length
      || !Array.from(output.data).every(value => Number.isFinite(value) && value >= 0 && value <= 1)) throw new Error('Invalid scores');
    const top = Array.from(output.data).indexOf(Math.max(...output.data));
    scores.push({ label: LABELS[top], confidence: output.data[top] });
  }
  return scores;
}

parentPort?.on('message', async ({ id, bytes, tiles, viewportWidth }) => {
  try { parentPort.postMessage({ id, scores: await classify(bytes, tiles, viewportWidth) }); }
  catch { parentPort.postMessage({ id, error: 'Image classification failed' }); }
});
