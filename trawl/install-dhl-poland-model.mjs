import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

const source = 'https://raw.githubusercontent.com/cateyelow/recaptcha_ia_solver/b8049e7243f6f1e6f7d4c6e9e4eb4befc0eaab21/models/recaptcha_classifier.onnx';
const expected = '0a06366eea09cfb802ec9445d6bb3a531ba32e283bf763ebdcff200aaa659934';
const response = await fetch(source, { signal: AbortSignal.timeout(120000) });
if (!response.ok) throw new Error('DHL Poland model download failed');
const bytes = new Uint8Array(await response.arrayBuffer());
if (bytes.length !== 20_402_226 || createHash('sha256').update(bytes).digest('hex') !== expected) throw new Error('DHL Poland model integrity mismatch');
await writeFile(new URL('./dhl-poland-model/classifier.onnx', import.meta.url), bytes);
