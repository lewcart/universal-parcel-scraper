// Produce a self-contained Dockerfile for Coolify's Dockerfile application type.
// Source remains reviewable here; Coolify stores the generated build definition.
import { readFileSync } from 'node:fs';
const read = name => readFileSync(new URL(name, import.meta.url));
const base = read('Dockerfile').toString().split('\n')[0];
const license = read('LICENSE').toString('base64');
const helpers = [
  'tracking-capture.mjs', 'royal-mail-history.mjs', 'fedex-session.mjs',
  'australia-post-browser.mjs', 'dhl-express-browser.mjs', 'wanbexpress-browser.mjs', 'xpo-browser.mjs',
  'sf-express-session.mjs', 'sf-express-gap.mjs',
];
const install = read('install.mjs').toString('base64');
const copies = helpers.map(name => `printf '%s' '${read(name).toString('base64')}' | base64 -d > /app/packages/tiers/src/utils/${name}`);
console.log(`${base}
LABEL org.opencontainers.image.source="https://github.com/plhery/universal-parcel-scraper" org.opencontainers.image.licenses="AGPL-3.0-only"
RUN mkdir -p /usr/share/licenses/trawl && printf '%s' '${license}' | base64 -d > /usr/share/licenses/trawl/LICENSE
RUN ${copies.join(' \\\n && ')} \\\n && printf '%s' '${install}' | base64 -d > /tmp/install-tracking-capture.mjs \\
 && bun /tmp/install-tracking-capture.mjs && rm /tmp/install-tracking-capture.mjs`);
