// Produce a self-contained Dockerfile for Coolify's Dockerfile application type.
// Source remains reviewable here; Coolify stores the generated build definition.
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
const read = name => readFileSync(new URL(name, import.meta.url));
const encoded = name => gzipSync(read(name), { level: 9 }).toString('base64');
const base = read('Dockerfile').toString().split('\n')[0];
const license = encoded('LICENSE');
const helpers = [
  'tracking-capture.mjs', 'royal-mail-history.mjs', 'fedex-session.mjs',
  'australia-post-browser.mjs', 'dhl-express-browser.mjs', 'wanbexpress-browser.mjs', 'xpo-browser.mjs',
  'asendia-browser.mjs',
  'sf-express-session.mjs', 'sf-express-gap.mjs',
];
const install = encoded('install.mjs');
const copies = helpers.map(name => `printf '%s' '${encoded(name)}' | base64 -d | gzip -d > /app/packages/tiers/src/utils/${name}`);
console.log(`${base}
LABEL org.opencontainers.image.source="https://github.com/plhery/universal-parcel-scraper" org.opencontainers.image.licenses="AGPL-3.0-only"
RUN mkdir -p /usr/share/licenses/trawl && printf '%s' '${license}' | base64 -d | gzip -d > /usr/share/licenses/trawl/LICENSE
RUN ${copies.join(' \\\n && ')} \\\n && printf '%s' '${install}' | base64 -d | gzip -d > /tmp/install-tracking-capture.mjs \\
 && bun /tmp/install-tracking-capture.mjs && rm /tmp/install-tracking-capture.mjs`);
