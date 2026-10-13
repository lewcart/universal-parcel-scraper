// Embed the reviewable source in one compressed payload so Coolify's base64
// SSH command stays below Linux's per-argument limit as helpers grow.
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
const read = name => readFileSync(new URL(name, import.meta.url), 'utf8');
const dockerfile = read('Dockerfile');
const copies = [...dockerfile.matchAll(/^COPY (\S+) (\S+)$/gm)];
const sources = Object.fromEntries(copies.map(([, name, target]) => [target, read(name)]));
const payload = gzipSync(JSON.stringify(sources), { level: 9 }).toString('base64');
const header = dockerfile.slice(0, dockerfile.indexOf('\nCOPY '));
const commands = dockerfile.slice(dockerfile.indexOf('\nRUN ') + 5).trim();
if (!copies.length || !commands.startsWith('bun install ')) throw new Error('Review the TRAWL Dockerfile before rendering');
console.log(`${header}
RUN printf '%s' '${payload}' | base64 -d | gzip -d > /tmp/upc-trawl-sources.json \\
 && bun -e 'import{readFileSync,writeFileSync,mkdirSync}from"node:fs";import{dirname}from"node:path";for(const[path,text]of Object.entries(JSON.parse(readFileSync("/tmp/upc-trawl-sources.json","utf8")))){mkdirSync(dirname(path),{recursive:true});writeFileSync(path,text)}' \\
 && rm /tmp/upc-trawl-sources.json \\
 && ${commands}`);
