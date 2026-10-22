// Embed the reviewable source in one compressed payload so Coolify's base64
// SSH command stays below Linux's per-argument limit as helpers grow.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync, constants } from 'node:zlib';
const read = name => readFileSync(new URL(name, import.meta.url), 'utf8');
const git = (...args) => execFileSync('git', args, { cwd: fileURLToPath(new URL('.', import.meta.url)), encoding: 'utf8' }).trim();
// The image names the commit its sources come from, so a redeploy from any
// checkout keeps it; sources that differ from that commit say so.
const revision = `${git('rev-parse', 'HEAD')}${git('status', '--porcelain', '--', '.') ? '-dirty' : ''}`;
const dockerfile = read('Dockerfile');
const copies = [...dockerfile.matchAll(/^COPY (\S+) (\S+)$/gm)];
const sources = Object.fromEntries(copies.map(([, name, target]) => [target, read(name)]));
const payload = brotliCompressSync(JSON.stringify(sources), { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).toString('base64');
// Docker limits physical lines even when the complete SSH argument still fits.
// printf joins these arguments without adding bytes to the compressed archive.
const chunks = payload.match(/.{1,16000}/g).map(chunk => `'${chunk}'`).join(' \\\n    ');
// Stage copies and dependency setup remain ordinary Docker instructions.
const firstSource = copies[0]?.index;
const header = dockerfile.slice(0, firstSource).trimEnd();
const commands = dockerfile.slice(dockerfile.lastIndexOf('\nRUN ') + 5).trim();
if (!copies.length || commands !== 'bun /tmp/install-tracking-capture.mjs && rm /tmp/install-tracking-capture.mjs') {
  throw new Error('Review the TRAWL Dockerfile before rendering');
}
console.log(`${header}
LABEL org.opencontainers.image.revision="${revision}"
RUN printf '%s' ${chunks} | base64 -d > /tmp/upc-trawl-sources.br \\
 && bun -e 'import{readFileSync,writeFileSync,mkdirSync}from"node:fs";import{dirname}from"node:path";import{brotliDecompressSync}from"node:zlib";for(const[path,text]of Object.entries(JSON.parse(brotliDecompressSync(readFileSync("/tmp/upc-trawl-sources.br")).toString("utf8")))){mkdirSync(dirname(path),{recursive:true});writeFileSync(path,text)}' \\
 && rm /tmp/upc-trawl-sources.br \\
 && ${commands}`);
