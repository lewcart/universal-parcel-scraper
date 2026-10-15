import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

let active = 0;

/** One disposable, offline worker per challenge. No screenshots or tokens persist. */
export function solveZtoCharacters(input, signal, timeoutMs) {
  if (active >= 2 || signal.aborted || timeoutMs < 1000) return Promise.resolve(null);
  active++;
  return new Promise(resolve => {
    let output = '', invalid = false;
    const child = spawn('/opt/zto-ocr/bin/python', [fileURLToPath(new URL('./zto-ocr.py', import.meta.url))],
      { stdio: ['pipe', 'pipe', 'ignore'], env: { ...process.env, OMP_NUM_THREADS: '1', OPENBLAS_NUM_THREADS: '1' } });
    const stop = () => { invalid = true; child.kill('SIGKILL'); };
    const timer = setTimeout(stop, Math.min(16000, timeoutMs));
    signal.addEventListener('abort', stop, { once: true });
    child.stdout.on('data', data => { output += data.toString(); if (output.length > 4096) stop(); });
    child.stdin.on('error', () => {});
    child.on('error', () => { invalid = true; });
    child.on('close', code => {
      clearTimeout(timer); signal.removeEventListener('abort', stop); active--;
      try { resolve(!invalid && code === 0 ? JSON.parse(output) : null); } catch { resolve(null); }
    });
    if (signal.aborted) stop();
    else child.stdin.end(JSON.stringify(input));
  });
}
