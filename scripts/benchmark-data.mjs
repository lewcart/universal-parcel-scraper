/*
 * The carrier benchmark: benchmark/carriers.json names the carriers and their public
 * numbers, benchmark/results.jsonl holds the last answer of every source for every
 * number. This module grades them and renders benchmark/README.md's tables.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export const SOURCES = ['direct', 'Ship24', 'ParcelsApp', '17TRACK', 'Postal Ninja', 'UPU'];
export const PROVIDERS = SOURCES.slice(1);
/** Outcomes that say nothing about the source: a failed lookup keeps the answer it would replace. */
export const INCONCLUSIVE = new Set(['error', 'blocked']);
const DAY = 86_400_000;
const WORDS = { no_history: 'No history', undated: 'Undated', summary_only: 'Summary only', postcode_prompt: 'Postcode prompt',
  wrong_carrier: 'Wrong carrier', refused: 'Refused', error: 'Error', blocked: 'Blocked', unrun: 'Not run',
  'n/a': 'N/A', no_adapter: 'No adapter' };
// Which answer a carrier's row shows when none of its numbers has history.
const SHOWN = ['undated', 'summary_only', 'postcode_prompt', 'wrong_carrier', 'refused', 'no_history', 'blocked', 'error', 'unrun', 'n/a', 'no_adapter'];

export const keyOf = (record) => `${record.carrier}|${record.number}|${record.source}`;

export function readResults(file) {
  return existsSync(file) ? readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line)) : [];
}

/** The list with each number's source, from the carrier's corpus unless the list gives one. */
export function loadBenchmark(root) {
  const read = (name) => JSON.parse(readFileSync(path.join(root, name), 'utf8'));
  const results = new Map(readResults(path.join(root, 'benchmark', 'results.jsonl')).map((record) => [keyOf(record), record]));
  return read('benchmark/carriers.json').carriers.map((entry) => {
    const folder = path.join(root, 'carriers', entry.carrier);
    const catalog = existsSync(path.join(folder, 'carrier.json'));
    const corpus = catalog && existsSync(path.join(folder, 'numbers.json')) ? read(`carriers/${entry.carrier}/numbers.json`).records : [];
    const numbers = entry.numbers.map((item) => {
      const record = corpus.find((candidate) => candidate.number === item.number);
      const answers = Object.fromEntries(SOURCES.map((source) => [source, results.get(keyOf({ carrier: entry.carrier, number: item.number, source }))]));
      return { ...item, source: item.source ?? record?.source ?? null, record: record ?? null, answers };
    });
    const name = entry.name ?? (catalog ? read(`carriers/${entry.carrier}/carrier.json`).displayName : entry.carrier);
    return { ...entry, name, catalog, numbers };
  });
}

/**
 * One source's grade for one number: history with its rows and the reasons it looks
 * partial beside the other sources' answers for the same number, or the answer.
 */
export function grade(number, source) {
  const review = number.review?.[source];
  if (review) return { outcome: review };
  const answer = number.answers[source];
  if (!answer) return { outcome: 'unrun' };
  if (answer.outcome !== 'history') return { outcome: answer.outcome };
  if (source === 'UPU') return { outcome: 'history', rows: answer.rows, partial: [] };
  const peers = SOURCES.filter((peer) => peer !== 'UPU' && !number.review?.[peer])
    .map((peer) => number.answers[peer]).filter((peer) => peer?.outcome === 'history');
  const most = Math.max(...peers.map((peer) => peer.rows));
  const newest = Math.max(...peers.map((peer) => Date.parse(peer.latest ?? '') || 0));
  const partial = [
    answer.rows * 3 <= most && peers.length > 1 ? 'a third of the rows or fewer' : null,
    answer.undated * 2 > answer.rows ? 'undated rows' : null,
    newest - (Date.parse(answer.latest ?? '') || 0) > DAY ? 'stops early' : null,
  ].filter(Boolean);
  return { outcome: 'history', rows: answer.rows, partial };
}

/** A carrier's grade for a source: its fullest history over its numbers, else the most telling answer. */
export function carrierGrade(entry, source) {
  const grades = entry.numbers.map((number) => grade(number, source));
  const histories = grades.filter((item) => item.outcome === 'history');
  if (histories.length) return histories.sort((a, b) => a.partial.length - b.partial.length || b.rows - a.rows)[0];
  return { outcome: SHOWN.find((outcome) => grades.some((item) => item.outcome === outcome)) ?? grades[0].outcome };
}

export const hasHistory = (item) => item.outcome === 'history';
export const cellText = (item) => item.outcome === 'history' ? `✓ ${item.rows}${item.partial.length ? ', partial' : ''}` : WORDS[item.outcome] ?? item.outcome;

export function summarize(entries) {
  const direct = entries.filter((entry) => hasHistory(carrierGrade(entry, 'direct'))).length;
  const providers = Object.fromEntries(PROVIDERS.map((source) => [source, entries.filter((entry) => hasHistory(carrierGrade(entry, source))).length]));
  const combined = entries.filter((entry) => SOURCES.some((source) => hasHistory(carrierGrade(entry, source)))).length;
  const full = Object.fromEntries(SOURCES.map((source) => [source, entries.filter((entry) => {
    const item = carrierGrade(entry, source);
    return hasHistory(item) && !item.partial.length;
  }).length]));
  // Scans without times: the source has a history the library does not use.
  const undated = Object.fromEntries(SOURCES.map((source) => [source, entries.filter((entry) => carrierGrade(entry, source).outcome === 'undated').length]));
  return { carriers: entries.length, listed: entries.filter((entry) => !entry.catalog).length, direct, combined, providers, full, undated };
}

const sourceLink = (number) => number.source ? `[${number.source.date ?? 'undated'}](${number.source.url})` : '';
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor((sorted.length - 1) / 2)] : null;
};

/** The generated blocks of benchmark/README.md. */
export function renderBenchmark(entries, root) {
  const counts = summarize(entries);
  const link = (entry) => entry.catalog
    ? `[${entry.name}](../carriers/${entry.carrier}/${existsSync(path.join(root, 'carriers', entry.carrier, 'README.md')) ? 'README.md' : 'carrier.json'})`
    : entry.name;
  const answers = entries.flatMap((entry) => entry.numbers.flatMap((number) => Object.values(number.answers).filter(Boolean)));
  const checked = answers.map((answer) => answer.checked).filter(Boolean).sort();
  const summary = [
    `${counts.carriers} carriers, ${counts.carriers - counts.listed} of them in the catalog, checked between ${checked[0] ?? '—'} and ${checked.at(-1) ?? '—'}.`,
    '',
    '| Source | Carriers with history | Full | Partial | Undated only | Median answer |',
    '| --- | ---: | ---: | ---: | ---: | ---: |',
    `| This project, all fallbacks enabled | ${counts.combined} | | | | |`,
    ...SOURCES.map((source) => {
      const total = source === 'direct' ? counts.direct : counts.providers[source];
      const ms = median(answers.filter((answer) => answer.source === source && answer.ms > 0).map((answer) => answer.ms));
      return `| ${source === 'direct' ? 'This project, dedicated adapters alone' : source} | ${total} | ${counts.full[source]} | ${total - counts.full[source]} | ${counts.undated[source]} | ${ms === null ? '—' : `${(ms / 1000).toFixed(1)} s`} |`;
    }),
    '',
    `${entries.filter((entry) => !SOURCES.some((source) => hasHistory(carrierGrade(entry, source)))).length} carriers have no number any source still follows.`,
  ].join('\n');
  const head = (first) => [`| ${first} | ${SOURCES.map((source) => source === 'direct' ? 'Direct' : source).join(' | ')} |`,
    `| --- | ${SOURCES.map(() => '---').join(' | ')} |`];
  const groups = [...new Set(entries.map((entry) => entry.group))];
  const carriers = groups.flatMap((group) => ['', `### ${group}`, '', ...head('Carrier'),
    ...entries.filter((entry) => entry.group === group)
      .map((entry) => `| ${link(entry)} | ${SOURCES.map((source) => cellText(carrierGrade(entry, source))).join(' | ')} |`)]).slice(1).join('\n');
  const numbers = [`| Carrier | Number | Posted | Checked | ${SOURCES.map((source) => source === 'direct' ? 'Direct' : source).join(' | ')} |`,
    `| --- | --- | --- | --- | ${SOURCES.map(() => '---').join(' | ')} |`,
    ...entries.flatMap((entry) => entry.numbers.map((number) => {
      const dates = Object.values(number.answers).map((answer) => answer?.checked).filter(Boolean).sort();
      const cells = SOURCES.map((source) => {
        const item = grade(number, source);
        return item.outcome === 'history' && item.partial.length ? `✓ ${item.rows}, partial (${item.partial.join(', ')})` : cellText(item);
      });
      return `| ${entry.name} | \`${number.number}\` | ${sourceLink(number)} | ${dates.at(-1) ?? ''} | ${cells.join(' | ')} |`;
    }))].join('\n');
  return { summary, carriers, numbers };
}
