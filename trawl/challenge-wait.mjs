// Upstream's Cloudflare wait counts any challenge frame as an interstitial. Sites
// also embed Turnstile in ordinary pages to protect a form. The wait then lasts
// until the request deadline and, once the site holds a clearance cookie, reloads
// the page every five seconds. Cloudflare's interstitial is still recognised by
// its title, HTML or URL; a frame alone keeps the wait only while the document
// cannot be read or shows a challenge wall's markers. The rule is not carrier-
// specific: an embedded widget is page content on any site, which TRAWL's page
// solvers handle after the wait.
const IMPORT = 'import { hasTurnstile, isCloudflarePage } from "./detect"';
const ACTIVE = String.raw`      const title = await page.title().catch(() => "")
      const html = await page.content().catch(() => "")
      const url = page.url()
      const hasChallengeFrame = page.frames().some(isChallengeFrame)
      const active =
        CF_CHALLENGE_TITLE.test(title) ||
        isCloudflarePage(html, responseHeaders()) ||
        /\/cdn-cgi\/challenge-platform|\/cdn-cgi\/challenge\//i.test(url) ||
        hasChallengeFrame
`;
const WALL_MARKERS = 'export function hasChallengeWallMarkers(html: string): boolean {';

function replaceOnce(source, before, after) {
  if (source.split(before).length !== 2) throw new Error('Review the upstream Cloudflare challenge wait');
  return source.replace(before, () => after);
}

export function challengeWaitSource(challengeWait, detect) {
  if (detect.split(WALL_MARKERS).length !== 2) throw new Error('Review the upstream challenge wall markers');
  const source = replaceOnce(challengeWait, IMPORT, IMPORT.replace('{ ', '{ hasChallengeWallMarkers, '));
  return replaceOnce(source, ACTIVE, ACTIVE.replace(/hasChallengeFrame\n$/,
    '(hasChallengeFrame && (!html || hasChallengeWallMarkers(html)))\n'));
}
