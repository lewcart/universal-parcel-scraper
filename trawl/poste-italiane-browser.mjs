const ORIGIN = 'https://www.poste.it';
const API = `${ORIGIN}/online/dovequando/DQ-REST/ricercasemplice`;
const MAX_BODY = 1_000_000;

export function posteItalianeBrowserNumber(rawUrl, capture = {}) {
  let url;
  try { url = new URL(rawUrl); } catch { return null; }
  const number = /^#\/risultati-spedizioni\/([A-Z0-9]{12,24})$/.exec(url.hash)?.[1];
  return url.origin === ORIGIN && !url.username && !url.password && url.pathname === '/cerca/index.html'
    && !url.search && number && /\d/.test(number) && capture.captureResponses?.length === 1
    && capture.captureResponses[0] === API ? number : null;
}

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const pick = (value, fields) => Object.fromEntries(fields.filter(key => Object.hasOwn(value, key)).map(key => {
  if (value[key] !== null && !['string', 'number', 'boolean'].includes(typeof value[key])) throw new Error('Invalid tracking field');
  return [key, value[key]];
}));
function trackingOnly(payload) {
  if (!record(payload)) throw new Error('Invalid tracking envelope');
  const result = pick(payload, ['idTracciatura', 'esitoRicerca', 'tipoSpedizione', 'tipoProdotto', 'stato', 'flagRitorno', 'dataPrevistaConsegna']);
  if (Object.hasOwn(payload, 'listaMovimenti')) {
    if (!Array.isArray(payload.listaMovimenti) || payload.listaMovimenti.length > 500) throw new Error('Invalid tracking history');
    result.listaMovimenti = payload.listaMovimenti.map(row => record(row)
      ? pick(row, ['statoLavorazione', 'dataOra', 'luogo', 'denominazioneUfficio', 'flagRitorno']) : null);
  }
  return result;
}

/** Let the official page submit its issued reCAPTCHA token and capture the resulting history. */
export async function runPosteItalianeBrowser({ url, handle, tier, maxTimeout, capture, installPolicy, solveCaptcha, signal }) {
  const number = posteItalianeBrowserNumber(url, capture);
  if (!number) return undefined;
  const started = Date.now();
  const entries = [];
  const controller = new AbortController();
  let context, page, timer, onResponse, abort;
  let accepting = true, expired = false, totalBytes = 0, statusCode = 0;
  let finish, challenge;
  const terminal = new Promise(resolve => { finish = resolve; });
  const challenged = new Promise(resolve => { challenge = resolve; });
  const remaining = () => Math.max(1, Math.floor(maxTimeout - (Date.now() - started)));
  const result = () => ({ tier, status: 'success', durationMs: Date.now() - started,
    effectiveUrl: url, html: '', body: new Uint8Array(), statusCode, cookies: [], capturedResponses: entries });
  const close = async target => {
    let closed = false, cleanup;
    try {
      await Promise.race([Promise.resolve().then(() => target.close()).then(() => { closed = true; }).catch(() => {}),
        new Promise(resolve => { cleanup = setTimeout(resolve, 1500); })]);
    } finally {
      clearTimeout(cleanup);
      if (!closed) handle.requestBrowserReplacement?.('Poste Italiane context cleanup failed');
    }
  };
  try {
    if (!Number.isFinite(maxTimeout) || maxTimeout < 1) throw new Error('No browser budget');
    signal?.throwIfAborted();
    await Promise.race([
      (async () => {
        const created = await handle.browser.newContext();
        handle.noteTemporaryContext?.();
        if (expired) { await close(created); throw new Error('Late browser context'); }
        context = created;
        page = await context.newPage();
        if (expired) throw new Error('Late browser page');
        await installPolicy?.(page);
        if (expired) throw new Error('Late browser policy');
        onResponse = response => {
          if (!accepting || response.url() !== API || response.request().method() !== 'POST') return;
          let request;
          try { request = response.request().postDataJSON(); } catch { return; }
          if (!record(request) || request.codiceSpedizione !== number || request.tipoRichiedente !== 'WEB') return;
          if (entries.length >= 10) { entries.at(-1).error = 'Poste tracking response limit exceeded'; accepting = false; finish(); return; }
          const headers = response.headers();
          const entry = { url: API, status: response.status(), body: null,
            headers: Object.fromEntries(['content-type', 'retry-after'].filter(key => headers[key])
              .map(key => [key, headers[key].slice(0, 100)])), truncated: false, base64Encoded: false, error: null };
          entries.push(entry);
          if (![200, 400].includes(entry.status)) { finish(); return; }
          const length = Number(headers['content-length'] ?? 0);
          if (!Number.isSafeInteger(length) || length < 0 || length > MAX_BODY || totalBytes >= 3 * MAX_BODY) {
            entry.truncated = true; finish(); return;
          }
          void response.body().then(body => {
            if (!accepting) return;
            totalBytes += body.length;
            if (body.length > MAX_BODY || totalBytes > 3 * MAX_BODY) { entry.truncated = true; finish(); return; }
            const payload = JSON.parse(body.toString('utf8'));
            if (entry.status === 400 && record(payload) && payload.id === 2 && payload.tipo === 'error'
              && /captcha/i.test(String(payload.descrizione))) {
              // Preserve the gate, without its request token or unrelated error details.
              entry.body = JSON.stringify({ id: 2, tipo: 'error', descrizione: 'CAPTCHA required' });
              challenge();
              if (request.captcha) finish();
              return;
            }
            if (entry.status === 200) entry.body = JSON.stringify(trackingOnly(payload));
            finish();
          }).catch(() => {
            if (accepting) { entry.error = 'Poste tracking response could not be decoded'; finish(); }
          });
        };
        page.on('response', onResponse);
        const navigation = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: remaining() });
        statusCode = navigation?.status() ?? 0;
        const gate = await Promise.race([terminal.then(() => false), challenged.then(() => true)]);
        if (gate && solveCaptcha && remaining() > 5000) {
          await page.getByRole('button', { name: 'Non accetto', exact: true }).click({ timeout: Math.min(1000, remaining()) }).catch(() => {});
          // Success removes the widget before the solver can see its tick. The
          // bound tracking reply, not that boolean, decides completion.
          const solved = await Promise.race([terminal, solveCaptcha(page, Math.min(30000, remaining()), controller.signal).catch(() => false)]);
          if (solved === true) await terminal;
        }
        // A refused solve leaves the captured challenge; do not wait out the deadline.
        if (!gate) await terminal;
      })(),
      new Promise((_, reject) => {
        const stop = () => { expired = true; controller.abort(); reject(new Error('Poste browser deadline')); };
        timer = setTimeout(stop, maxTimeout);
        abort = stop;
        signal?.addEventListener('abort', abort, { once: true });
        if (signal?.aborted) stop();
      }),
    ]);
    return result();
  } catch {
    if (entries.length) return result();
    return { tier, status: 'error', durationMs: Date.now() - started,
      reason: expired ? 'Poste Italiane browser budget exhausted' : 'Poste Italiane browser retrieval failed' };
  } finally {
    accepting = false; expired = true; controller.abort(); clearTimeout(timer);
    if (abort) signal?.removeEventListener('abort', abort);
    if (page && onResponse) page.off('response', onResponse);
    if (context) await close(context);
  }
}
