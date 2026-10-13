import { parseHTML } from 'linkedom';

const ORIGIN = 'https://sprawdz.dhl.com.pl';
const ENDPOINT = `${ORIGIN}/`;
const MAX_BODY = 500_000;

export function dhlPolandBrowserNumber(rawUrl, capture = {}) {
  let url;
  try { url = new URL(rawUrl); } catch { return null; }
  const number = url.searchParams.get('sn');
  if (url.origin !== ORIGIN || url.pathname !== '/' || url.username || url.password || url.hash
    || !/^\d{11}$/.test(number ?? '') || url.searchParams.get('lang') !== 'en-gb'
    || [...url.searchParams].length !== 2 || capture.captureResponses?.length !== 1
    || capture.captureResponses[0] !== ENDPOINT) return null;
  return number;
}

/** Only shipment identity and scan rows leave the browser service. */
export function dhlPolandHistory(html) {
  const { document } = parseHTML(html);
  const text = element => (element?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const heads = [...document.querySelectorAll('.trackHead .dhl_black_color')];
  const rows = [...document.querySelectorAll('#addit_infoHead .topBotPads15')];
  if (heads.length !== 1 || !/^\d{11}$/.test(text(heads[0])) || rows.length > 500) {
    return { challenge: !!document.querySelector('[name="g-recaptcha-response"], .g-recaptcha') };
  }
  return { number: text(heads[0]), events: rows.map(row => {
    const cells = [...row.children].filter(child => child.localName === 'div');
    if (cells.length !== 4) return null;
    // The delivery row appends the recipient's acknowledgement name.
    const description = text(cells[3]).replace(/\s*(?:The (?:shipment|parcel) (?:was )?received by|Przesyłka odebrana przez)\b[\s\S]*$/i, '').trim();
    if (description.length > 500 || text(cells[2]).length > 200) return null;
    return { date: text(cells[0]), time: text(cells[1]), location: text(cells[2]), description };
  }) };
}

/** DHL's own form owns the verification token and submits the verified waybill. */
export async function runDhlPolandBrowser({ url, capture, handle, tier, maxTimeout, installPolicy, solveCaptcha }) {
  const number = dhlPolandBrowserNumber(url, capture);
  if (!number) return undefined;
  const start = Date.now();
  const cleanupMs = Math.min(1500, Math.max(1, Math.floor(maxTimeout / 5)));
  const deadline = start + maxTimeout - cleanupMs;
  const remaining = () => Math.max(1, Math.floor(deadline - Date.now()));
  let context, page, timer, onResponse;
  let accepting = true, expired = false, statusCode = 0, count = 0, bytesRead = 0;
  const entries = [], pending = new Set();
  const close = async target => {
    let closed = false, cleanupTimer;
    try {
      await Promise.race([Promise.resolve().then(() => target.close()).then(() => { closed = true; }).catch(() => {}),
        new Promise(resolve => { cleanupTimer = setTimeout(resolve, cleanupMs); })]);
    } finally {
      clearTimeout(cleanupTimer);
      if (!closed) handle.requestBrowserReplacement?.('DHL Poland context cleanup failed');
    }
  };
  const result = () => ({ tier, status: 'success', durationMs: Date.now() - start, effectiveUrl: url,
    html: '', body: new Uint8Array(), statusCode, cookies: [], capturedResponses: entries });
  try {
    if (!Number.isFinite(maxTimeout) || maxTimeout < 2) throw new Error('No browser budget');
    return await Promise.race([
      (async () => {
        const created = await handle.browser.newContext();
        handle.noteTemporaryContext?.();
        if (expired) { await close(created); throw new Error('Browser context arrived too late'); }
        context = created;
        page = await context.newPage();
        if (expired) throw new Error('Browser page arrived too late');
        await installPolicy?.(page);
        if (expired) throw new Error('Browser setup exceeded its budget');
        let finish;
        const terminal = new Promise(resolve => { finish = resolve; });
        onResponse = response => {
          if (!accepting || response.url() !== ENDPOINT || response.request().method() !== 'POST') return;
          const request = new URLSearchParams(response.request().postData() ?? '');
          if (request.getAll('SearchMode').length !== 1 || request.get('SearchMode') !== 'Shipment'
            || request.getAll('ShipmentNumbers').length !== 1 || request.get('ShipmentNumbers') !== number) return;
          if (++count > 10) { entries.at(-1).error = 'DHL Poland response limit exceeded'; accepting = false; finish(); return; }
          const headers = response.headers();
          const entry = { url: ENDPOINT, status: response.status(), trackingNumberSubmitted: number,
            headers: Object.fromEntries(['content-type', 'retry-after'].filter(key => headers[key]).map(key => [key, headers[key].slice(0, 100)])),
            body: null, truncated: false, base64Encoded: false, error: null };
          entries.push(entry);
          if (entry.status !== 200) { finish(); return; }
          const length = Number(headers['content-length'] ?? 0);
          if (!Number.isSafeInteger(length) || length < 0 || length > MAX_BODY || bytesRead >= 3 * MAX_BODY) {
            entry.truncated = true; finish(); return;
          }
          const read = response.body().then(bytes => {
            if (!accepting) return;
            bytesRead += bytes.length;
            if (bytes.length > MAX_BODY || bytesRead > 3 * MAX_BODY) entry.truncated = true;
            else entry.body = JSON.stringify(dhlPolandHistory(bytes.toString('utf8')));
          }).catch(() => { if (accepting) entry.error = 'DHL Poland response could not be read'; })
            .finally(() => { pending.delete(read); finish(); });
          pending.add(read);
        };
        page.on('response', onResponse);
        statusCode = (await page.goto(`${ENDPOINT}?lang=en-gb`, { waitUntil: 'domcontentloaded', timeout: remaining() }))?.status() ?? 0;
        if (statusCode >= 400) return result();
        const reject = page.locator('#onetrust-reject-all-handler');
        if (await reject.waitFor({ state: 'visible', timeout: Math.min(5000, remaining()) }).then(() => true, () => false)) {
          await reject.evaluate(element => element.click());
        }
        await page.locator('#sn').fill(number, { timeout: remaining() });
        // Use the visible checkbox's normal actionability checks after consent.
        // A forced click beneath an overlay can leave the generic solver waiting
        // for a challenge frame that the browser never opened.
        await page.frameLocator('iframe[src*="recaptcha"][src*="anchor"]').first().locator('#recaptcha-anchor').click({ timeout: Math.min(10000, remaining()) });
        const checked = await page.waitForFunction(() => document.querySelector('#g-recaptcha-response')?.value.length > 0,
          null, { timeout: Math.min(5000, remaining()) }).then(() => true, () => false);
        if (!checked && remaining() > 5000) await solveCaptcha?.(page, Math.min(45000, remaining()));
        if (expired) return result();
        const verified = await page.locator('#g-recaptcha-response').inputValue({ timeout: remaining() }).then(value => value.length > 0, () => false);
        if (!verified) return result();
        await page.locator('#searchSubmit').click({ timeout: remaining() });
        await terminal;
        await page.waitForTimeout(Math.min(300, remaining()));
        await Promise.allSettled([...pending]);
        return result();
      })(),
      new Promise((_, reject) => { timer = setTimeout(() => { expired = true; reject(new Error('Browser deadline')); }, remaining()); }),
    ]);
  } catch {
    if (statusCode || entries.length) return result();
    return { tier, status: 'error', durationMs: Date.now() - start, reason: 'DHL Poland browser retrieval failed' };
  } finally {
    accepting = false; expired = true; clearTimeout(timer);
    if (page && onResponse) page.off('response', onResponse);
    if (context) await close(context);
  }
}
