import type { AdapterFactory, TrackingContext } from '../../core/adapter/index.js';
import { ChallengeError, IndeterminateError, RateLimitedError, SchemaError, TransportError } from '../../core/errors/index.js';
import type { CarrierResult } from '../../core/result/index.js';
import { runSteps } from '../../core/runner/index.js';
import { NOOP_RECORDER, type StepRecorder } from '../../core/telemetry/index.js';
import { decodeText, fetchBounded, userAgentOf } from '../../core/transport/index.js';
import { isRecord } from '../../core/types.js';
import { componentState, packMessage, readRenderBatch, RenderedPage, serverComponents, unpackMessages, type Packed } from './blazor.js';
import { normalizeSkynetSaNumber, parseSkynetSa, PROVIDER, skynetSaPageState } from './parser.js';

/** SkyTrack, the tracker SkyNet's WooCommerce plugin links each booked waybill to. */
export const SKYNET_SA_TRACKER = 'https://web.skynet.co.za:5002/';
/** The app's SignalR hub, which renders its pages. */
export const SKYNET_SA_HUB = `${SKYNET_SA_TRACKER}_blazor`;

/** The tracking page for one waybill, which looks it up as it opens. */
export function skynetSaPageUrl(number: string): string {
  return `${SKYNET_SA_TRACKER}T?R=${normalizeSkynetSaNumber(number)}`;
}

const HANDSHAKE = '{"protocol":"blazorpack","version":1}\u001e';
// SignalR's message types: a call, a call's result and the server's goodbye.
const INVOCATION = 1;
const COMPLETION = 3;
const CLOSE = 7;
// The id the circuit's start is called under, which its result answers.
const START = '0';
// The shell is under fifty kilobytes, and a long history's batches well under a megabyte.
const SHELL_MAX_BYTES = 512 * 1024;
const HUB_MAX_BYTES = 4 * 1024 * 1024;
const MAX_POLLS = 12;
const CLOSE_MS = 2_000;
// Bot checks a CDN or firewall could put in place of the shell.
const CHALLENGE = /_cf_chl_opt|cf-turnstile|<title>\s*(?:Just a moment|Attention Required)|captcha/i;

/**
 * One connection to SkyTrack's hub for one waybill: it opens the page's
 * circuit, applies the render batches the server sends and answers the
 * browser calls the page makes, until the page answers the lookup.
 */
class Circuit {
  readonly #page = new RenderedPage();
  readonly #roots: number[] = [];
  #url = '';
  #started = false;
  #closed = false;

  constructor(private readonly options: { fetcher?: typeof fetch; userAgent?: string }, private readonly number: string,
    private readonly signal: AbortSignal, private readonly deadline: number) {}

  async #request(url: string, method: 'GET' | 'POST' | 'DELETE', body?: string | Uint8Array<ArrayBuffer>,
    limits: { maxBytes?: number; timeoutMs?: number } = {}): Promise<{ status: number; bytes: Uint8Array }> {
    const { response, bytes } = await fetchBounded(url, { method, signal: this.signal, headers: {
      'User-Agent': userAgentOf(this.options.userAgent), 'X-Requested-With': 'XMLHttpRequest',
      ...(body === undefined ? {} : { 'Content-Type': typeof body === 'string' ? 'text/plain;charset=UTF-8' : 'application/octet-stream' }),
    }, body }, { provider: PROVIDER, timeoutMs: limits.timeoutMs ?? Math.max(1, Math.floor(this.deadline - performance.now())),
      maxBytes: limits.maxBytes ?? HUB_MAX_BYTES, redirect: 'manual', fetcher: this.options.fetcher,
      allowHttpStatuses: [301, 302, 303, 307, 308, 403, 404, 410, 429] });
    if (response.status === 429) throw new RateLimitedError(PROVIDER, undefined, 'SkyNet South Africa refused the lookup for now', { status: 429 });
    if (response.status === 403) throw new ChallengeError(PROVIDER, 'SkyNet South Africa refused the lookup', { status: 403 });
    if (response.status >= 300 && response.status < 400) throw new TransportError(PROVIDER, 'SkyNet South Africa redirected its tracker');
    if (response.status === 404 || response.status === 410) {
      throw new TransportError(PROVIDER, url.startsWith(SKYNET_SA_HUB) ? 'SkyNet South Africa dropped the tracker\'s connection'
        : 'SkyNet South Africa\'s tracker is unavailable');
    }
    return { status: response.status, bytes };
  }

  /** What the server sent since the last poll; a 204 is its goodbye. */
  async #poll(): Promise<Uint8Array> {
    const { status, bytes } = await this.#request(this.#url, 'GET');
    if (status === 204) throw new TransportError(PROVIDER, 'SkyNet South Africa closed the tracker\'s connection');
    return bytes;
  }

  async #send(message: Packed): Promise<void> {
    await this.#request(this.#url, 'POST', packMessage(message));
  }

  async #handle(bytes: Uint8Array): Promise<void> {
    for (const message of unpackMessages(bytes)) {
      if (!Array.isArray(message) || typeof message[0] !== 'number') throw new SchemaError(PROVIDER, 'SkyNet South Africa returned an invalid message');
      if (message[0] === CLOSE) {
        this.#closed = true;
        return;
      }
      if (message[0] === COMPLETION && message[2] === START) {
        // An error result, or none, is a page the server would not open.
        if (message[3] !== 3 || typeof message[4] !== 'string' || !message[4]) {
          throw new TransportError(PROVIDER, 'SkyNet South Africa did not open the tracking page');
        }
        this.#started = true;
      }
      if (message[0] !== INVOCATION) continue;
      const [, , , target, args] = message;
      if (typeof target !== 'string' || !Array.isArray(args)) throw new SchemaError(PROVIDER, 'SkyNet South Africa returned an invalid message');
      if (target === 'JS.AttachComponent') {
        if (typeof args[0] !== 'number') throw new SchemaError(PROVIDER, 'SkyNet South Africa attached an invalid component');
        this.#roots.push(args[0]);
      } else if (target === 'JS.RenderBatch') {
        const [id, batch] = args;
        if (typeof id !== 'number' || !(batch instanceof Uint8Array)) throw new SchemaError(PROVIDER, 'SkyNet South Africa returned an invalid render batch');
        this.#page.apply(readRenderBatch(batch));
        await this.#send([INVOCATION, {}, null, 'OnRenderCompleted', [id, null]]);
      } else if (target === 'JS.BeginInvokeJS') {
        const [handle, identifier] = args;
        if (typeof handle !== 'number' || typeof identifier !== 'string') throw new SchemaError(PROVIDER, 'SkyNet South Africa made an invalid page call');
        // The lookup runs as the page opens; a move elsewhere is not its answer.
        if (identifier.endsWith('navigationManager.navigateTo')) throw new SchemaError(PROVIDER, 'SkyNet South Africa\'s tracker moved to another page');
        // The page's scripts set up its widgets and focus; none of their results matters to the lookup.
        await this.#send([INVOCATION, {}, null, 'EndInvokeJSFromDotNet', [handle, true, JSON.stringify([handle, true, null])]]);
      } else if (target === 'JS.Error') {
        throw new IndeterminateError(PROVIDER, 'SkyNet South Africa\'s tracker failed while rendering the page');
      }
    }
  }

  async track(): Promise<CarrierResult> {
    const page = skynetSaPageUrl(this.number);
    const shell = decodeText((await this.#request(page, 'GET', undefined, { maxBytes: SHELL_MAX_BYTES })).bytes);
    const components = serverComponents(shell);
    if (!components.length) {
      if (CHALLENGE.test(shell.slice(0, 64_000))) throw new ChallengeError(PROVIDER, 'SkyNet South Africa answered with a browser check');
      throw new SchemaError(PROVIDER, 'SkyNet South Africa\'s tracking page changed');
    }
    const negotiation = await this.#request(`${SKYNET_SA_HUB}/negotiate?negotiateVersion=1`, 'POST', '');
    let reply: unknown;
    try { reply = JSON.parse(decodeText(negotiation.bytes)); } catch { reply = null; }
    const transports = isRecord(reply) && Array.isArray(reply.availableTransports) ? reply.availableTransports : [];
    const token = isRecord(reply) ? reply.connectionToken : null;
    if (typeof token !== 'string' || !/^[\w-]{1,200}$/.test(token)
      || !transports.some((item) => isRecord(item) && item.transport === 'LongPolling'
        && Array.isArray(item.transferFormats) && item.transferFormats.includes('Binary'))) {
      throw new SchemaError(PROVIDER, 'SkyNet South Africa\'s tracker offered no usable connection');
    }
    this.#url = `${SKYNET_SA_HUB}?id=${encodeURIComponent(token)}`;
    try {
      // The first poll finishes opening the connection and returns at once.
      await this.#poll();
      await this.#request(this.#url, 'POST', HANDSHAKE);
      let received = await this.#poll();
      const separator = received.indexOf(0x1e);
      let handshake: unknown;
      try { handshake = JSON.parse(decodeText(received.subarray(0, separator))); } catch { handshake = null; }
      if (separator < 0 || !isRecord(handshake) || handshake.error !== undefined) {
        throw new SchemaError(PROVIDER, 'SkyNet South Africa refused the tracker\'s protocol');
      }
      received = received.subarray(separator + 1);
      // ASP.NET Core 8's start also takes the component state the shell carries.
      await this.#send([INVOCATION, {}, START, 'StartCircuit', [SKYNET_SA_TRACKER, page, JSON.stringify(components), componentState(shell)]]);
      for (let polls = 0; ; polls++) {
        await this.#handle(received);
        const html = this.#roots.map((root) => this.#page.html(root)).join('');
        const state = skynetSaPageState(html, this.number);
        // The not-found line counts once the page has opened, not while it loads.
        if (state === 'shipment' || (state === 'not_found' && this.#started)) return parseSkynetSa(html, this.number);
        if (this.#closed) throw new TransportError(PROVIDER, 'SkyNet South Africa closed the tracker\'s connection');
        if (polls >= MAX_POLLS) throw new IndeterminateError(PROVIDER, 'SkyNet South Africa\'s tracker did not render an answer');
        received = await this.#poll();
      }
    } finally {
      await this.#close();
    }
  }

  /** Ends the connection, so the server drops the circuit at once; a failure changes nothing. */
  async #close(): Promise<void> {
    if (this.signal.aborted) return;
    try {
      await this.#request(this.#url, 'DELETE', undefined, { timeoutMs: Math.max(1, Math.min(CLOSE_MS, Math.floor(this.deadline - performance.now()))) });
    } catch {
      // The server drops an idle circuit on its own.
    }
  }
}

export class SkynetSaTracker {
  constructor(private readonly options: { fetcher?: typeof fetch; recorder?: StepRecorder; userAgent?: string } = {}) {}

  async fetch(raw: string, context: TrackingContext = {}): Promise<CarrierResult> {
    const number = normalizeSkynetSaNumber(raw);
    return runSteps({ carrier: 'skynet-sa', budgetMs: context.budgetMs ?? 20_000, signal: context.signal,
      recorder: this.options.recorder ?? NOOP_RECORDER }, [
      { id: 'direct', run: ({ signal, remainingMs }) =>
        new Circuit(this.options, number, signal, performance.now() + remainingMs).track() },
    ]);
  }
}

export const adapter: AdapterFactory = (environment) => {
  const tracker = new SkynetSaTracker({ fetcher: environment.fetcher, recorder: environment.recorder, userAgent: environment.userAgent });
  return {
    id: 'skynet-sa', recordsSteps: true, steps: ['direct'],
    track: (input, context) => tracker.fetch(input.number, context),
  };
};
