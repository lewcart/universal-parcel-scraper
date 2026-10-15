import { parentPort } from 'node:worker_threads';
import { readFile } from 'node:fs/promises';
import * as ort from 'onnxruntime-web';
import sharp from 'sharp';
import characters from './model/characters.json' with { type: 'json' };

ort.env.wasm.numThreads = 1;
// The original model's declared output shape is stale; its actual tensor is checked below.
ort.env.logLevel = 'error';
let session;

export function decodeViettelLogits(data, dims) {
  if (dims.length !== 3 || dims[0] < 1 || dims[0] > 64 || dims[1] !== 1 || dims[2] !== 8210 || data.length !== dims[0] * 8210) {
    throw new Error('Invalid OCR tensor');
  }
  let previous = -1, answer = '';
  for (let step = 0; step < dims[0]; step++) {
    let best = 0;
    for (let column = 0; column < 8210; column++) {
      const value = data[step * 8210 + column];
      if (!Number.isFinite(value)) throw new Error('Invalid OCR score');
      if (value > data[step * 8210 + best]) best = column;
    }
    if (best !== previous && best !== 0) {
      const character = characters[best];
      if (!character) return '';
      answer += character;
    }
    previous = best;
  }
  return answer;
}

async function solve(bytes) {
  if (!(bytes instanceof Uint8Array) || !bytes.length || bytes.length > 50_000) throw new Error('unsupported-image');
  const image = sharp(bytes, { limitInputPixels: 200 * 50, pages: 1, failOn: 'warning' });
  const metadata = await image.metadata();
  if (metadata.format !== 'png' || metadata.width !== 200 || metadata.height !== 50 || (metadata.pages ?? 1) !== 1) throw new Error('unsupported-image');
  const pixels = await image.flatten({ background: '#ffffff' }).greyscale().resize(256, 64).raw().toBuffer();
  if (pixels.length !== 256 * 64) throw new Error('unsupported-image');
  if (!session) session = await ort.InferenceSession.create(new Uint8Array(await readFile(new URL('./model/captcha.onnx', import.meta.url))),
    { executionProviders: ['wasm'], graphOptimizationLevel: 'all', logSeverityLevel: 3 });
  const input = new ort.Tensor('float32', Float32Array.from(pixels, value => value / 127.5 - 1), [1, 1, 64, 256]);
  const output = (await session.run({ input1: input }))['387'];
  if (!output || output.type !== 'float32') throw new Error('Invalid OCR output');
  return decodeViettelLogits(output.data, output.dims);
}

parentPort?.on('message', async ({ id, bytes }) => {
  try { parentPort.postMessage({ id, answer: await solve(bytes) }); }
  catch (error) { parentPort.postMessage({ id, error: error?.message === 'unsupported-image' ? 'unsupported-image' : 'inference-failed' }); }
});
