import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripTypeScriptTypes } from 'node:module';
import { challengeWaitSource } from './challenge-wait.mjs';

// The upstream polling sample, reduced to the expression the patch changes.
const upstream = String.raw`import type { Frame, Page } from "patchright"
import { hasTurnstile, isCloudflarePage } from "./detect"

export const CF_CHALLENGE_TITLE = /just a moment|verify you are human|please wait|one more step|attention required/i

const CF_CHALLENGE_ORIGINS = ["challenges.cloudflare.com", "cdn-cgi/challenge-platform"]

export async function sample(page: Page, responseHeaders: () => Record<string, string>): Promise<boolean> {
      const title = await page.title().catch(() => "")
      const html = await page.content().catch(() => "")
      const url = page.url()
      const hasChallengeFrame = page.frames().some(isChallengeFrame)
      const active =
        CF_CHALLENGE_TITLE.test(title) ||
        isCloudflarePage(html, responseHeaders()) ||
        /\/cdn-cgi\/challenge-platform|\/cdn-cgi\/challenge\//i.test(url) ||
        hasChallengeFrame
  return active
}

function isChallengeFrame(frame: Frame): boolean {
  const url = frame.url()
  return CF_CHALLENGE_ORIGINS.some((o) => url.includes(o))
}
`;
const detect = `export function hasChallengeWallMarkers(html: string): boolean {
  return false
}
`;
// Synthetic stand-ins for upstream's detectors.
const detectors = `function isCloudflarePage(html, headers) { return headers["cf-mitigated"] === "challenge" || /_cf_chl_opt/.test(html) }
function hasChallengeWallMarkers(html) { return /<title>Security check<\\/title>/i.test(html) }
`;

async function load(source) {
  const js = stripTypeScriptTypes(source.replace(/^import .*\n/gm, ''), { mode: 'strip' });
  return import(`data:text/javascript;base64,${Buffer.from(detectors + js).toString('base64')}`);
}

const widget = 'https://challenges.cloudflare.com/cdn-cgi/challenge-platform/h/g/turnstile/f/ov2/av0/rch/synthetic/0x4AAAAAAA/auto/fbE/new/normal/auto/';
const ordinary = '<html><head><title>Parcel tools</title></head><body><iframe title="Tracking widget"></iframe></body></html>';
function page({ title = 'Parcel tools', html = ordinary, url = 'https://shop.example/tools', frames = [widget] } = {}) {
  return {
    title: async () => title,
    content: async () => { if (html instanceof Error) throw html; return html; },
    url: () => url,
    frames: () => ['https://shop.example/widget', ...frames].map(frameUrl => ({ url: () => frameUrl })),
  };
}

const cases = [
  ['a widget embedded in an ordinary page', page(), {}, false, true],
  ['an ordinary page without a widget', page({ frames: [] }), {}, false, false],
  ['an interstitial title', page({ title: 'Just a moment...' }), {}, true, true],
  ['interstitial HTML', page({ html: '<html><script>window._cf_chl_opt={}</script></html>' }), {}, true, true],
  ['a challenge response header', page(), { 'cf-mitigated': 'challenge' }, true, true],
  ['a challenge path', page({ url: 'https://shop.example/cdn-cgi/challenge-platform/h/g/orchestrate' }), {}, true, true],
  ['a wall that only its frame and markers identify', page({ html: '<html><head><title>Security check</title></head></html>' }), {}, true, true],
  ['wall markers without a frame', page({ html: '<html><head><title>Security check</title></head></html>', frames: [] }), {}, false, false],
  ['a frame on a document that cannot be read', page({ html: new Error('navigation') }), {}, true, true],
];

test('a Turnstile frame counts as a challenge only on a document that may be a wall', async () => {
  const patched = await load(challengeWaitSource(upstream, detect));
  const stock = await load(upstream);
  for (const [name, sample, headers, active, stockActive] of cases) {
    assert.equal(await patched.sample(sample, () => headers), active, name);
    assert.equal(await stock.sample(sample, () => headers), stockActive, `upstream: ${name}`);
  }
});

test('the patch changes only the frame signal and the detector import', () => {
  const output = challengeWaitSource(upstream, detect);
  assert.ok(output.includes('import { hasChallengeWallMarkers, hasTurnstile, isCloudflarePage } from "./detect"'));
  assert.ok(output.includes('        (hasChallengeFrame && (!html || hasChallengeWallMarkers(html)))\n'));
  assert.equal(output.split('\n').length, upstream.split('\n').length);
});

test('upstream changes to the wait or its detectors stop the build', () => {
  assert.throws(() => challengeWaitSource(upstream.replace('        hasChallengeFrame\n', '        hasChallengeFrame ||\n        false\n'), detect));
  assert.throws(() => challengeWaitSource(upstream.replace('const html = await page.content()', 'const html = await readDocument(page)'), detect));
  assert.throws(() => challengeWaitSource(upstream.replace('{ hasTurnstile, isCloudflarePage }', '{ isCloudflarePage }'), detect));
  assert.throws(() => challengeWaitSource(upstream + upstream.slice(upstream.indexOf('      const title')), detect));
  assert.throws(() => challengeWaitSource(upstream, detect.replace('hasChallengeWallMarkers', 'hasWallMarkers')));
});
