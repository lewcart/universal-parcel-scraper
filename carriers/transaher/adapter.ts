import { accepted, recognizeFromLookup, type AdapterFactory, type TrackingContext } from '../../core/adapter/index.js';
import { ChallengeError, IndeterminateError, RateLimitedError, SchemaError, TransportError } from '../../core/errors/index.js';
import type { CarrierResult } from '../../core/result/index.js';
import { runSteps } from '../../core/runner/index.js';
import { NOOP_RECORDER, type StepRecorder } from '../../core/telemetry/index.js';
import { decodeText, fetchBounded, userAgentOf } from '../../core/transport/index.js';
import { isRecord } from '../../core/types.js';
import { packMessage, readRenderBatch, RenderedPage, serverComponents, unpackMessages, type Packed } from './blazor.js';
import { normalizeTransaherNumber, parseTransaher, PROVIDER, transaherPageState } from './parser.js';

/** The tracker's app, which the tracking box on transaher.es opens. */
export const TRANSAHER_TRACKER = 'https://clientes.transaher.es/webclient/';
/** The app's SignalR hub, which renders its pages. */
export const TRANSAHER_HUB = `${TRANSAHER_TRACKER}_blazor`;

/** The tracking page for one number, where the box's `htracking` link moves after checking the device. */
export function transaherPageUrl(number: string): string {
  return `${TRANSAHER_TRACKER}tracking/-5,0,${normalizeTransaherNumber(number)}`;
}

const HANDSHAKE = '{"protocol":"blazorpack","version":1}\u001e';
// SignalR's message types: a call, a call's result, a keep-alive and the server's goodbye.
const INVOCATION = 1;
const COMPLETION = 3;
const CLOSE = 7;
// The id the circuit's start is called under, which its result answers.
const START = '0';
// The shell is under two kilobytes, and a long shipment page's batches well under a megabyte.
const SHELL_MAX_BYTES = 256 * 1024;
const HUB_MAX_BYTES = 4 * 1024 * 1024;
const MAX_POLLS = 12;
const CLOSE_MS = 2_000;
// Bot checks a CDN or firewall could put in place of the shell.
const CHALLENGE = /_cf_chl_opt|cf-turnstile|<title>\s*(?:Just a moment|Attention Required)|captcha/i;

/**
 * One connection to the tracker's hub for one number: it opens the page's
 * circuit, applies the render batches the server sends and answers the
 * browser calls the page makes, until the page shows a shipment or says the
 * number is unknown.
 */
class Circuit {
  readonly #page = new RenderedPage();
  #url = '';
  #root: number | null = null;
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
    if (response.status === 429) throw new RateLimitedError(PROVIDER, undefined, 'Transaher refused the lookup for now', { status: 429 });
    if (response.status === 403) throw new ChallengeError(PROVIDER, 'Transaher refused the lookup', { status: 403 });
    if (response.status >= 300 && response.status < 400) throw new TransportError(PROVIDER, 'Transaher redirected its tracker');
    if (response.status === 404 || response.status === 410) {
      throw new TransportError(PROVIDER, url.startsWith(TRANSAHER_HUB) ? 'Transaher dropped the tracker\'s connection' : 'Transaher\'s tracker is unavailable');
    }
    return { status: response.status, bytes };
  }

  /** What the server sent since the last poll; a 204 is its goodbye. */
  async #poll(): Promise<Uint8Array> {
    const { status, bytes } = await this.#request(this.#url, 'GET');
    if (status === 204) throw new TransportError(PROVIDER, 'Transaher closed the tracker\'s connection');
    return bytes;
  }

  async #send(message: Packed): Promise<void> {
    await this.#request(this.#url, 'POST', packMessage(message));
  }

  /** Answers one call the server makes to the page's scripts. */
  async #invokeJs(args: Packed[]): Promise<void> {
    const [handle, identifier, json] = args;
    if (typeof handle !== 'number' || typeof identifier !== 'string') throw new SchemaError(PROVIDER, 'Transaher made an invalid page call');
    let result: Packed = null;
    if (identifier === 'isDevice') result = false;
    if (identifier === 'Blazor._internal.navigationManager.navigateTo') {
      // The page may move to its own address again; any other page is not the tracker's answer.
      let target: unknown;
      try { [target] = JSON.parse(typeof json === 'string' ? json : '[]') as unknown[]; } catch { target = null; }
      if (typeof target !== 'string' || !/^https:\/\/clientes\.transaher\.es\/webclient\/h?tracking\/-5,0,(\d+)$/.test(target)
        || !target.endsWith(`,${this.number}`)) throw new SchemaError(PROVIDER, 'Transaher\'s tracker moved to another page');
      await this.#send([INVOCATION, {}, null, 'OnLocationChanged', [target, false]]);
    }
    await this.#send([INVOCATION, {}, null, 'EndInvokeJSFromDotNet', [handle, true, JSON.stringify([handle, true, result])]]);
  }

  async #handle(bytes: Uint8Array): Promise<void> {
    for (const message of unpackMessages(bytes)) {
      if (!Array.isArray(message) || typeof message[0] !== 'number') throw new SchemaError(PROVIDER, 'Transaher returned an invalid message');
      if (message[0] === CLOSE) {
        this.#closed = true;
        return;
      }
      if (message[0] === COMPLETION && message[2] === START) {
        // An error result, or none, is a page the server would not open.
        if (message[3] !== 3 || typeof message[4] !== 'string' || !message[4]) throw new TransportError(PROVIDER, 'Transaher did not open the tracking page');
        this.#started = true;
      }
      if (message[0] !== INVOCATION) continue;
      const [, , , target, args] = message;
      if (typeof target !== 'string' || !Array.isArray(args)) throw new SchemaError(PROVIDER, 'Transaher returned an invalid message');
      if (target === 'JS.AttachComponent') {
        if (typeof args[0] !== 'number') throw new SchemaError(PROVIDER, 'Transaher attached an invalid component');
        this.#root ??= args[0];
      } else if (target === 'JS.RenderBatch') {
        const [id, batch] = args;
        if (typeof id !== 'number' || !(batch instanceof Uint8Array)) throw new SchemaError(PROVIDER, 'Transaher returned an invalid render batch');
        this.#page.apply(readRenderBatch(batch));
        await this.#send([INVOCATION, {}, null, 'OnRenderCompleted', [id, null]]);
      } else if (target === 'JS.BeginInvokeJS') {
        await this.#invokeJs(args);
      } else if (target === 'JS.Error') {
        throw new IndeterminateError(PROVIDER, 'Transaher\'s tracker failed while rendering the page');
      }
    }
  }

  async track(): Promise<CarrierResult> {
    const page = transaherPageUrl(this.number);
    const shell = decodeText((await this.#request(page, 'GET', undefined, { maxBytes: SHELL_MAX_BYTES })).bytes);
    const components = serverComponents(shell);
    if (!components.length) {
      if (CHALLENGE.test(shell.slice(0, 64_000))) throw new ChallengeError(PROVIDER, 'Transaher answered with a browser check');
      throw new SchemaError(PROVIDER, 'Transaher\'s tracking page changed');
    }
    const negotiation = await this.#request(`${TRANSAHER_HUB}/negotiate?negotiateVersion=1`, 'POST', '');
    let reply: unknown;
    try { reply = JSON.parse(decodeText(negotiation.bytes)); } catch { reply = null; }
    const transports = isRecord(reply) && Array.isArray(reply.availableTransports) ? reply.availableTransports : [];
    const token = isRecord(reply) ? reply.connectionToken : null;
    if (typeof token !== 'string' || !/^[\w-]{1,200}$/.test(token)
      || !transports.some((item) => isRecord(item) && item.transport === 'LongPolling'
        && Array.isArray(item.transferFormats) && item.transferFormats.includes('Binary'))) {
      throw new SchemaError(PROVIDER, 'Transaher\'s tracker offered no usable connection');
    }
    this.#url = `${TRANSAHER_HUB}?id=${encodeURIComponent(token)}`;
    try {
      // The first poll finishes opening the connection and returns at once.
      await this.#poll();
      await this.#request(this.#url, 'POST', HANDSHAKE);
      let received = await this.#poll();
      const separator = received.indexOf(0x1e);
      let handshake: unknown;
      try { handshake = JSON.parse(decodeText(received.subarray(0, separator))); } catch { handshake = null; }
      if (separator < 0 || !isRecord(handshake) || handshake.error !== undefined) throw new SchemaError(PROVIDER, 'Transaher refused the tracker\'s protocol');
      received = received.subarray(separator + 1);
      await this.#send([INVOCATION, {}, START, 'StartCircuit', [TRANSAHER_TRACKER, page, JSON.stringify(components)]]);
      for (let polls = 0; ; polls++) {
        await this.#handle(received);
        const html = this.#root === null ? '' : this.#page.html(this.#root);
        const state = transaherPageState(html);
        // The unknown number's sentence counts once the page has opened, not while it loads.
        if (state === 'shipment' || (state === 'not_found' && this.#started)) return parseTransaher(html, this.number);
        if (this.#closed) throw new TransportError(PROVIDER, 'Transaher closed the tracker\'s connection');
        if (polls >= MAX_POLLS) throw new IndeterminateError(PROVIDER, 'Transaher\'s tracker did not render an answer');
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

export class TransaherTracker {
  constructor(private readonly options: { fetcher?: typeof fetch; recorder?: StepRecorder; userAgent?: string } = {}) {}

  async fetch(raw: string, context: TrackingContext = {}): Promise<CarrierResult> {
    const number = normalizeTransaherNumber(raw);
    return runSteps({ carrier: 'transaher', budgetMs: context.budgetMs ?? 20_000, signal: context.signal,
      recorder: this.options.recorder ?? NOOP_RECORDER }, [
      { id: 'direct', run: ({ signal, remainingMs }) =>
        new Circuit(this.options, number, signal, performance.now() + remainingMs).track() },
    ]);
  }
}

export const adapter: AdapterFactory = (environment) => {
  const tracker = new TransaherTracker({ fetcher: environment.fetcher, recorder: environment.recorder, userAgent: environment.userAgent });
  return {
    id: 'transaher', recordsSteps: true, steps: ['direct'],
    track: (input, context) => tracker.fetch(input.number, context),
    recognize: (number, context) => recognizeFromLookup(() => tracker.fetch(number, context),
      () => accepted(() => normalizeTransaherNumber(number))),
  };
};
