import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

test('Coolify includes every helper copied by the regular Dockerfile with identical bytes', () => {
  const dockerfile = readFileSync(new URL('./Dockerfile', import.meta.url), 'utf8');
  const rendered = execFileSync(process.execPath, [new URL('./render-coolify.mjs', import.meta.url).pathname], { encoding: 'utf8', cwd: '/tmp' });
  for (const [, file, target] of dockerfile.matchAll(/^COPY (\S+) (\S+)$/gm)) {
    const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = new RegExp(`printf '%s' '([^']+)' \\| base64 -d > ${escaped}(?:\\s|$)`).exec(rendered);
    assert.ok(match, `${file} must be present in Coolify`);
    assert.deepEqual(Buffer.from(match[1], 'base64'), readFileSync(new URL(file, import.meta.url)), file);
  }
  assert.ok(rendered.split('\n').slice(4, -2).every(line => line.endsWith('\\')), 'one continued helper installation');
});
