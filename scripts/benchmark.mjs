/*
 * Runs the carrier benchmark (benchmark/README.md) and stores its answers.
 *
 *   node scripts/benchmark.mjs probe [--carriers a,b] [--sources direct,UPU] [--unrun] [--retry]
 *   node scripts/benchmark.mjs merge <results.jsonl>
 *
 * `probe` asks every source for every number of benchmark/carriers.json through
 * coverage-probe.run.ts, then merges the answers into benchmark/results.jsonl.
 * `--carriers` and `--sources` narrow it; `--unrun` asks only the sources with no
 * stored answer for a number, `--retry` also those whose stored answer is an error
 * or a challenge. The lookups land in a file under the system's temporary
 * directory first, so an interrupted run can still be merged.
 *
 * The browser service is COVERAGE_PROBE_TRAWL_URL (17TRACK, Postal Ninja and the
 * browser-backed adapters need it) and TRACKING_CHROMIUM_PATH a local Chromium.
 * Run `npm run generate` after a merge to redraw the tables and the README counts.
 */

import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { INCONCLUSIVE, keyOf, loadBenchmark, readResults, SOURCES } from './benchmark-data.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const resultsPath = path.join(root, 'benchmark', 'results.jsonl');
const [command, ...args] = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(`--${name}`);
  return index < 0 ? null : args[index + 1].split(',');
};

function merge(file) {
  const entries = loadBenchmark(root);
  const order = new Map(entries.flatMap((entry) => entry.numbers.flatMap((number) =>
    SOURCES.map((source) => keyOf({ carrier: entry.carrier, number: number.number, source })))).map((key, index) => [key, index]));
  const stored = new Map(readResults(resultsPath).map((record) => [keyOf(record), record]));
  let added = 0;
  for (const record of readResults(file)) {
    if (record.number === undefined) continue;
    const key = keyOf(record), previous = stored.get(key);
    if (INCONCLUSIVE.has(record.outcome) && previous && !INCONCLUSIVE.has(previous.outcome)) {
      console.log(`kept ${key}: ${previous.outcome} (${previous.checked}) over ${record.outcome}`);
      continue;
    }
    delete record.reference;
    stored.set(key, record);
    added++;
  }
  const dropped = [...stored.keys()].filter((key) => !order.has(key));
  for (const key of dropped) stored.delete(key);
  const lines = [...stored.values()].sort((a, b) => order.get(keyOf(a)) - order.get(keyOf(b))).map((record) => JSON.stringify(record));
  writeFileSync(resultsPath, lines.length ? `${lines.join('\n')}\n` : '');
  console.log(`Merged ${added} answers into benchmark/results.jsonl${dropped.length ? `, dropped ${dropped.length} for numbers no longer listed` : ''}.`);
}

function probe() {
  const carriers = option('carriers'), sources = option('sources') ?? SOURCES;
  const unknown = sources.filter((source) => !SOURCES.includes(source));
  if (unknown.length) throw new Error(`Unknown source ${unknown.join(', ')}; use ${SOURCES.join(', ')}`);
  const pending = (number, source) => {
    const answer = number.answers[source];
    if (args.includes('--retry')) return !answer || INCONCLUSIVE.has(answer.outcome);
    return args.includes('--unrun') ? !answer : true;
  };
  const cases = loadBenchmark(root).filter((entry) => !carriers || carriers.includes(entry.carrier))
    .flatMap((entry) => entry.numbers.map((number) => ({ carrier: entry.carrier, number: number.number, postcode: number.postcode ?? null,
      public: true, sources: sources.filter((source) => pending(number, source)) })))
    .filter((item) => item.sources.length);
  if (!cases.length) return console.log('Nothing to ask.');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const casesPath = path.join(os.tmpdir(), `benchmark-${stamp}.cases.json`), out = path.join(os.tmpdir(), `benchmark-${stamp}.jsonl`);
  writeFileSync(casesPath, JSON.stringify(cases));
  console.log(`${cases.length} numbers, ${cases.reduce((sum, item) => sum + item.sources.length, 0)} lookups; answers in ${out}`);
  const result = spawnSync('npx', ['vitest', 'run', '--config', 'scripts/coverage-probe.config.ts'], {
    cwd: root, stdio: 'inherit', env: { ...process.env, COVERAGE_PROBE_CASES: casesPath, COVERAGE_PROBE_OUT: out },
  });
  if (result.error) throw result.error;
  merge(out);
  process.exit(result.status ?? 1);
}

if (command === 'probe') probe();
else if (command === 'merge' && args[0]) merge(args[0]);
else {
  console.error('Usage: benchmark.mjs probe [--carriers a,b] [--sources direct,UPU] [--unrun] [--retry] | merge <results.jsonl>');
  process.exit(1);
}
