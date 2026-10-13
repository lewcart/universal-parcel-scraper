import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dhlPolandNativeSources } from '/app/packages/tiers/src/utils/dhl-poland-native.mjs';

const nativeDir = '/app/packages/tiers/src/utils/dhl-poland-native';
const nativeSources = dhlPolandNativeSources(
  readFileSync('/app/packages/tiers/src/solvers/recaptcha.ts', 'utf8'),
  readFileSync('/app/packages/tiers/src/solvers/stt.ts', 'utf8'));
mkdirSync(nativeDir, { recursive: true });
writeFileSync(`${nativeDir}/recaptcha.ts`, nativeSources.recaptcha);
writeFileSync(`${nativeDir}/stt.ts`, nativeSources.stt);
// TRAWL drops a result that arrives at its request deadline. Helpers, capture
// waits and CAPTCHA solvers end this long before it, which leaves time to close
// a context and return what was observed.
const reserveMs = 2_500;
// Tier 2 reuses a cached session; tiers 3 and 4 share one fresh-context task.
// Both must use the same capture semantics.
for (const [file, tier, fresh] of [['2.ts', '2', false], ['browser.ts', 'tier', true]]) {
  const path = `/app/packages/tiers/src/tiers/${file}`;
  const source = readFileSync(path, 'utf8');
  const needle = 'const pageCapture = attachPageCapture(page, capture)';
  if (source.split(needle).length !== 2) throw new Error('TRAWL source changed: review the tracking capture integration');
  const solverGuard = 'if (solveRemaining > 5000)';
  if (source.split(solverGuard).length !== 2) throw new Error('TRAWL solver guard changed');
  const beforeSolve = 'const solveRemaining = budget.remaining()';
  if (source.split(beforeSolve).length !== 2) throw new Error('TRAWL solver integration changed');
  // The helpers open their own context, so they run before the tier opens one.
  const entry = 'if (!budget) throw new Error("Browser task requires an operation budget")';
  if (source.split(entry).length !== 2) throw new Error('TRAWL tier entry changed');
  const carrierRunners = `${entry}
  const carrierPage = ${fresh ? '!proxyUrl && !capture.sessionContext && ' : ''}!screenshot && (!method || method === "GET")
    && !body && !Object.keys(extraHeaders ?? {}).length
  const carrierRun = { url, handle, tier: ${tier}, maxTimeout: budget.remaining() - ${reserveMs}, capture,
    installPolicy: page => installOutboundPolicy(page, validateOutboundUrl) }
  if (carrierPage && dhlPolandBrowserNumber(url, capture)) {
    return await runDhlPolandBrowser({ ...carrierRun,
      solveNativeCaptcha: (page, timeout, report) => solveDhlPolandNative(page, timeout, budget.signal, report) })
  }
  if (carrierPage && asendiaBrowserNumber(url, capture)) return await runAsendiaBrowser(carrierRun)
  if (carrierPage && dhlExpressBrowserNumber(url, capture)) return await runDhlExpressBrowser(carrierRun)
  if (carrierPage && sfExpressSessionNumber(url, capture)) {
    return await sfExpressSessions.run({ ...carrierRun, signal: budget.signal })
  }
  if (carrierPage && australiaPostBrowserRequest(url, capture)) return await runAustraliaPostBrowser(carrierRun)
  if (carrierPage && fedexSessionNumber(url, capture)) return await fedexSessions.run(carrierRun)
  if (carrierPage && wanbBrowserNumber(url, capture)) {
    return await runWanbBrowser({ ...carrierRun, solveCaptcha: (page, timeout) => solveRecaptchaV2(page, timeout) })
  }
  if (carrierPage && xpoBrowserNumber(url, capture)) {
    return await runXpoBrowser({ ...carrierRun, solveCaptcha: (page, timeout) => solveRecaptchaV2(page, timeout) })
  }`;
  writeFileSync(path, 'import { attachTrackingCapture, reserveDeadline } from "../utils/tracking-capture.mjs"\n'
    + 'import { solveRecaptchaV2 } from "../solvers/recaptcha"\n'
    + 'import { wanbBrowserNumber, runWanbBrowser } from "../utils/wanbexpress-browser.mjs"\n'
    + 'import { xpoBrowserNumber, runXpoBrowser } from "../utils/xpo-browser.mjs"\n'
    + 'import { solveRecaptchaV2 as solveDhlPolandNative } from "../utils/dhl-poland-native/recaptcha"\n'
    + 'import { dhlPolandBrowserNumber, runDhlPolandBrowser } from "../utils/dhl-poland-browser.mjs"\n'
    + 'import { asendiaBrowserNumber, runAsendiaBrowser } from "../utils/asendia-browser.mjs"\n'
    + 'import { dhlExpressBrowserNumber, runDhlExpressBrowser } from "../utils/dhl-express-browser.mjs"\n'
    + 'import { australiaPostBrowserRequest, runAustraliaPostBrowser } from "../utils/australia-post-browser.mjs"\n'
    + 'import { sfExpressSessionNumber, sfExpressSessions } from "../utils/sf-express-session.mjs"\n'
    + 'import { fedexSessions, fedexSessionNumber } from "../utils/fedex-session.mjs"\n'
    + source.replace(entry, carrierRunners)
      .replace(needle, 'const pageCapture = reserveDeadline(await attachTrackingCapture(page, url, capture)'
        + ` ?? attachPageCapture(page, capture), ${reserveMs})`)
      .replace(solverGuard, 'if (solveRemaining > 5000 && !pageCapture.hasResponse?.() && !pageCapture.hasTrackingRequest?.())')
      // A widget the solver cannot pass must not cost the page behind it.
      .replace(beforeSolve, 'await pageCapture.prepare?.(budget.remaining())\n    '
        + `${beforeSolve} - ${reserveMs}`));
}

// The client classifies an HTTP-only failure by the page's own status and
// headers, which TRAWL leaves out of its attempt history.
const orchestratorPath = '/app/packages/tiers/src/orchestrator.ts';
const orchestrator = readFileSync(orchestratorPath, 'utf8');
const attempt = '      ...(r.reason === undefined ? {} : { reason: r.reason }),';
if (orchestrator.split(attempt).length !== 2) throw new Error('TRAWL attempt history changed');
writeFileSync(orchestratorPath, orchestrator.replace(attempt, attempt + '\n      ...(r.status === "success"'
  + ' || r.statusCode === undefined ? {} : { statusCode: r.statusCode, responseHeaders: r.responseHeaders }),'));

// Retention only helps if the next pool lease returns to the working browser.
// The helper has no dependency on BrowserPool and shares the tier singleton.
const poolPath = '/app/packages/browser/src/pool.ts';
const pool = readFileSync(poolPath, 'utf8');
const pick = '    if (domain) {\n      const sticky = available.find';
if (pool.split(pick).length !== 2) throw new Error('TRAWL browser affinity integration changed');
writeFileSync(poolPath, 'import { preferredFedExEntry } from "../../tiers/src/utils/fedex-session.mjs"\n'
  + pool.replace(pick, '    const retained = preferredFedExEntry(available, domain)\n'
    + '    if (retained) return retained\n' + pick));
