import { readFileSync } from 'node:fs';
import { load } from 'cheerio';
import type { ChildNode } from 'domhandler';
import { describe, expect, it, vi } from 'vitest';
import { statusMapAnswer } from '../../core/catalog/statusMaps.js';
import { detectCarrierMatch } from '../../core/detection/index.js';
import { NoHistoryError } from '../../core/errors/index.js';
import { NOOP_RECORDER } from '../../core/telemetry/index.js';
import { createTracker } from '../../facade/index.js';
import { adapter, TRANSAHER_HUB, TRANSAHER_TRACKER, TransaherTracker, transaherPageUrl } from './adapter.js';
import { packMessage, readRenderBatch, RenderedPage, unpackMessages, type Frame, type Packed } from './blazor.js';
import { normalizeTransaherNumber, parseTransaher } from './parser.js';
import { transaherStage } from './status.js';
import statuses from './statuses.json' with { type: 'json' };

const DELIVERED = '103011090070012345000000001';
const IN_TRANSIT = '103011090070012346000000002';
const UNKNOWN = '103000000000000000000000003';
const TOKEN = 'synthetic-token_1';
const POLL = `${TRANSAHER_HUB}?id=${TOKEN}`;

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const carrier = (fetcher: typeof fetch) => adapter({ fetcher, recorder: NOOP_RECORDER, env: {}, trawl: null, browserExecutablePath: null });
const join = (...parts: Uint8Array[]) => {
  const bytes = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  parts.reduce((at, part) => (bytes.set(part, at), at + part.length), 0);
  return bytes;
};

// --- A render batch writer, the reverse of ASP.NET Core 5's layout, for the fake hub.

type EditSpec = { type: number; sibling?: number; reference?: number; removed?: string };
type BatchSpec = { diffs: { componentId: number; edits: EditSpec[] }[]; frames: Frame[]; disposed?: number[] };

function writeBatch({ diffs, frames, disposed = [] }: BatchSpec): Uint8Array {
  const bytes: number[] = [];
  const int = (value: number) => {
    bytes.push(value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >>> 24) & 0xff);
  };
  const strings: string[] = [];
  const string = (value: string | null | undefined) => {
    if (value === null || value === undefined) return -1;
    const known = strings.indexOf(value);
    return known >= 0 ? known : strings.push(value) - 1;
  };
  const diffAt = diffs.map(({ componentId, edits }) => {
    const at = bytes.length;
    int(componentId);
    int(edits.length);
    for (const edit of edits) [edit.type, edit.sibling ?? 0, edit.reference ?? 0, string(edit.removed)].forEach(int);
    return at;
  });
  const updated = bytes.length;
  int(diffs.length);
  diffAt.forEach(int);
  const references = bytes.length;
  int(frames.length);
  for (const frame of frames) {
    const fields = frame.type === 'element' ? [1, frame.length, string(frame.name)]
      : frame.type === 'text' ? [2, string(frame.text)]
        : frame.type === 'attribute' ? [3, string(frame.name), string(frame.value)]
          : frame.type === 'component' ? [4, frame.length, frame.id]
            : frame.type === 'region' ? [5, frame.length]
              : frame.type === 'markup' ? [8, string(frame.markup)] : [6];
    [...fields, 0, 0, 0, 0, 0].slice(0, 5).forEach(int);
  }
  const disposedAt = bytes.length;
  int(disposed.length);
  disposed.forEach(int);
  const handlers = bytes.length;
  int(0);
  const stringAt = strings.map((value) => {
    const at = bytes.length;
    const encoded = new TextEncoder().encode(value);
    let length = encoded.length;
    do {
      bytes.push((length & 0x7f) | (length > 0x7f ? 0x80 : 0));
      length >>>= 7;
    } while (length);
    bytes.push(...encoded);
    return at;
  });
  const table = bytes.length;
  stringAt.forEach(int);
  [updated, references, disposedAt, handlers, table].forEach(int);
  return new Uint8Array(bytes);
}

/** The frames of an HTML fragment, as the server writes an element's attributes before its children. */
function framesOf(nodes: readonly ChildNode[]): Frame[] {
  const frames: Frame[] = [];
  for (const node of nodes) {
    if (node.nodeType === 3) frames.push({ type: 'text', text: node.data });
    if (node.nodeType !== 1 || !('attribs' in node)) continue;
    const at = frames.push({ type: 'capture' }) - 1;
    for (const [name, value] of Object.entries(node.attribs)) frames.push({ type: 'attribute', name, value });
    frames.push(...framesOf(node.children));
    frames[at] = { type: 'element', name: node.name, length: frames.length - at };
  }
  return frames;
}

/** A root component holding the page's component, which renders the fragment in a region. */
function pageBatch(html: string): Uint8Array {
  const page = framesOf(load(html, null, false).root()[0]!.children);
  return writeBatch({
    frames: [
      { type: 'element', name: 'div', length: 4 }, { type: 'attribute', name: 'class', value: 'rz-layout' }, { type: 'capture' },
      { type: 'component', length: 1, id: 1 },
      { type: 'region', length: page.length + 1 }, ...page,
    ],
    diffs: [{ componentId: 0, edits: [{ type: 1, sibling: 0, reference: 0 }] }, { componentId: 1, edits: [{ type: 1, sibling: 0, reference: 4 }] }],
  });
}

// --- The hub's side of the connection.

const invocation = (target: string, args: Packed[]) => packMessage([1, {}, null, target, args, []]);
const attach = () => invocation('JS.AttachComponent', [0, 'app']);
const render = (id: number, batch: Uint8Array) => invocation('JS.RenderBatch', [id, batch]);
const started = (kind = 3, result: Packed = 'synthetic-circuit') => packMessage([3, {}, '0', kind, result]);
const callJs = (handle: number, identifier: string, args: unknown[]) =>
  invocation('JS.BeginInvokeJS', [handle, identifier, JSON.stringify(args), 0, 0]);
const HANDSHAKE_REPLY = new TextEncoder().encode('{}\u001e');
const shipment = (page: string) => join(attach(), render(2, pageBatch(fixture(page))), started());

interface HubOptions {
  shell?: () => Response;
  negotiate?: () => Response;
  polls: (Uint8Array | (() => Response))[];
}

/** A fake tracker: the page's shell, the hub's negotiation, a queue of long-poll answers and the messages the adapter sends. */
function hub({ shell = () => new Response(fixture('shell.html'), { headers: { 'Content-Type': 'text/html' } }),
  negotiate = () => Response.json({ negotiateVersion: 1, connectionId: 'synthetic', connectionToken: TOKEN,
    availableTransports: [{ transport: 'WebSockets', transferFormats: ['Text', 'Binary'] },
      { transport: 'LongPolling', transferFormats: ['Text', 'Binary'] }] }),
  polls }: HubOptions) {
  const queue = [new Uint8Array(), HANDSHAKE_REPLY, ...polls];
  const requests: string[] = [];
  const sent: Packed[] = [];
  const texts: string[] = [];
  const fetcher = vi.fn<typeof fetch>(async (input, init) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    requests.push(`${method} ${url}`);
    if (url.startsWith(`${TRANSAHER_TRACKER}tracking/`) && method === 'GET') return shell();
    if (url === `${TRANSAHER_HUB}/negotiate?negotiateVersion=1` && method === 'POST') return negotiate();
    if (url !== POLL) throw new Error(`Unexpected request ${method} ${url}`);
    if (method === 'DELETE') return new Response(null, { status: 202 });
    if (method === 'POST') {
      if (typeof init?.body === 'string') texts.push(init.body);
      else sent.push(...unpackMessages(init!.body as Uint8Array));
      return new Response(null, { status: 200 });
    }
    const next = queue.shift() ?? new Uint8Array();
    return typeof next === 'function' ? next() : new Response(next as Uint8Array<ArrayBuffer>, { status: 200 });
  });
  return { fetcher, requests, sent, texts };
}

describe('Transaher HTTP adapter', () => {
  it('opens the tracking page’s circuit over long polling, through the supplied transport, and closes it', async () => {
    const { fetcher, requests, sent, texts } = hub({ polls: [shipment('delivered.html')] });
    const recorder = { ...NOOP_RECORDER, step: vi.fn(), lookup: vi.fn() };
    await expect(new TransaherTracker({ fetcher, recorder, userAgent: 'SyntheticHost/1.0' }).fetch(` ${DELIVERED.slice(0, 9)} ${DELIVERED.slice(9)} `))
      .resolves.toMatchObject({ current_stage: 'delivered' });
    const page = `${TRANSAHER_TRACKER}tracking/-5,0,${DELIVERED}`;
    expect(requests).toEqual([`GET ${page}`, `POST ${TRANSAHER_HUB}/negotiate?negotiateVersion=1`, `GET ${POLL}`, `POST ${POLL}`,
      `GET ${POLL}`, `POST ${POLL}`, `GET ${POLL}`, `POST ${POLL}`, `DELETE ${POLL}`]);
    for (const [, init] of fetcher.mock.calls) {
      expect(init).toMatchObject({ redirect: 'manual', signal: expect.any(AbortSignal), headers: { 'User-Agent': 'SyntheticHost/1.0' } });
    }
    // The negotiation posts an empty body, as the server asks for a length.
    expect(fetcher.mock.calls[1]![1]!.body).toBe('');
    expect(texts).toEqual(['{"protocol":"blazorpack","version":1}\u001e']);
    expect(sent).toEqual([
      [1, {}, '0', 'StartCircuit', [TRANSAHER_TRACKER, page, '[{"type":"server","sequence":0,"descriptor":"U3ludGhldGljRGVzY3JpcHRvcg+AA=="}]']],
      [1, {}, null, 'OnRenderCompleted', [2, null]],
    ]);
    expect(recorder.step).toHaveBeenCalledWith(expect.objectContaining({ carrier: 'transaher', step: 'direct', outcome: 'ok' }));
    expect(transaherPageUrl(DELIVERED)).toBe(page);
  });

  it('keeps each situation’s wall clock, newest first, and lets the summary’s delivery decide', async () => {
    const { fetcher } = hub({ polls: [shipment('delivered.html')] });
    const result = await carrier(fetcher).track({ number: DELIVERED });
    expect(result).toMatchObject({ status: 'delivered', current_stage: 'delivered', current_stage_source: 'carrier_map',
      last_status_text: 'Entregado', last_update: null, last_update_local: '2026-03-04T12:30:05', expected_delivery: null,
      sender_name: 'TIENDA DE EJEMPLO, S.L.' });
    expect(result.events!.map((event) => [event.local_time, event.stage ?? null, event.description])).toEqual([
      // The van's row is filed after the delivery it led to.
      ['2026-03-04T12:30:05', 'out_for_delivery', 'EN REPARTO'],
      ['2026-03-04T11:02:45', 'delivered', 'ENTREGADO'],
      ['2026-03-03T07:15:00', null, 'PEDIR DIA Y HORA DESCARGA'],
      // The repeated departure is kept once.
      ['2026-03-02T22:41:30', 'in_transit', 'SALIDA DE ORIGEN'],
      ['2026-03-02T14:20:00', 'registered', 'REGISTRADO'],
      ['2026-03-02T08:05:12', 'in_transit', 'SALIDA DE ORIGEN'],
    ]);
    expect(result.events!.every((event) => event.time === undefined && event.location === undefined)).toBe(true);
    expect(result).not.toHaveProperty('summary_only');
    expect(result).not.toHaveProperty('history_truncated');
    // The recipient, the reference, the shipping day and the proof of delivery are not kept.
    expect(JSON.stringify(result)).not.toMatch(/Lucía|PEDIDO|02-03-2026|Conforme|090-70012345/);
  });

  it('goes as far as the history when the summary’s status lags it', async () => {
    const { fetcher } = hub({ polls: [shipment('in-transit.html')] });
    await expect(carrier(fetcher).track({ number: IN_TRANSIT })).resolves.toEqual({ status: 'in_transit', current_stage: 'in_transit',
      current_stage_source: 'carrier_map', last_status_text: 'SALIDA DE ORIGEN', last_update: null, last_update_local: '2026-03-05T23:10:20',
      expected_delivery: null, sender_name: 'ALMACENES SINTÉTICOS, S.A.', events: [
        { local_time: '2026-03-05T23:10:20', description: 'SALIDA DE ORIGEN', stage: 'in_transit', stage_source: 'carrier_map' },
        { local_time: '2026-03-05T16:45:00', description: 'REGISTRADO', stage: 'registered', stage_source: 'carrier_map' },
      ] });
  });

  it('reads the unknown-number sentence once the page has opened, not while it loads', async () => {
    const { fetcher, requests } = hub({ polls: [join(attach(), render(2, pageBatch(fixture('not-found.html')))), started()] });
    await expect(carrier(fetcher).track({ number: UNKNOWN })).rejects.toMatchObject({ kind: 'not_found' });
    expect(requests.filter((request) => request === `GET ${POLL}`)).toHaveLength(4);
    expect(requests.at(-1)).toBe(`DELETE ${POLL}`);
  });

  it('renders the batches that replace the page’s loading state', async () => {
    const loading = writeBatch({ frames: [{ type: 'element', name: 'div', length: 2 }, { type: 'component', length: 1, id: 1 },
      { type: 'text', text: 'Cargando...' }], diffs: [{ componentId: 0, edits: [{ type: 1, sibling: 0, reference: 0 }] },
      { componentId: 1, edits: [{ type: 1, sibling: 0, reference: 2 }] }] });
    const page = framesOf(load(fixture('in-transit.html'), null, false).root()[0]!.children);
    const loaded = writeBatch({ frames: [{ type: 'region', length: page.length + 1 }, ...page],
      diffs: [{ componentId: 1, edits: [{ type: 2, sibling: 0 }, { type: 1, sibling: 0, reference: 0 }] }] });
    const { fetcher, sent } = hub({ polls: [join(attach(), render(2, loading), started()), render(3, loaded)] });
    await expect(carrier(fetcher).track({ number: IN_TRANSIT })).resolves.toMatchObject({ current_stage: 'in_transit' });
    expect(sent.slice(1)).toEqual([[1, {}, null, 'OnRenderCompleted', [2, null]], [1, {}, null, 'OnRenderCompleted', [3, null]]]);
  });

  it('answers the page’s device check and follows its move to its own tracking route', async () => {
    const page = `${TRANSAHER_TRACKER}tracking/-5,0,${DELIVERED}`;
    const { fetcher, sent } = hub({ polls: [join(attach(), callJs(4, 'isDevice', []), started()),
      callJs(5, 'Blazor._internal.navigationManager.navigateTo', [page, false, false]), shipment('delivered.html')] });
    await expect(carrier(fetcher).track({ number: DELIVERED })).resolves.toMatchObject({ current_stage: 'delivered' });
    expect(sent.slice(1, 4)).toEqual([
      [1, {}, null, 'EndInvokeJSFromDotNet', [4, true, '[4,true,false]']],
      [1, {}, null, 'OnLocationChanged', [page, false]],
      [1, {}, null, 'EndInvokeJSFromDotNet', [5, true, '[5,true,null]']],
    ]);
  });

  it('refuses a move to another page or another number', async () => {
    for (const target of ['https://transaher.es/', `${TRANSAHER_TRACKER}tracking/-5,0,${IN_TRANSIT}`, `${TRANSAHER_TRACKER}login`]) {
      const { fetcher } = hub({ polls: [join(attach(), callJs(4, 'Blazor._internal.navigationManager.navigateTo', [target, false]))] });
      await expect(carrier(fetcher).track({ number: DELIVERED }), target).rejects.toMatchObject({ kind: 'schema' });
    }
  });

  it('tells a browser check and a refusal from a missing parcel', async () => {
    const lookup = (options: Partial<HubOptions>) => carrier(hub({ polls: [], ...options }).fetcher).track({ number: DELIVERED });
    await expect(lookup({ shell: () => new Response('<html><title>Just a moment...</title></html>', { status: 403 }) }))
      .rejects.toMatchObject({ kind: 'challenge' });
    await expect(lookup({ shell: () => new Response('<html><head><title>Just a moment...</title></head><body><div id="cf-turnstile"></div></body></html>') }))
      .rejects.toMatchObject({ kind: 'challenge' });
    await expect(lookup({ shell: () => new Response('<html><title>WEBCLIENT</title></html>') })).rejects.toMatchObject({ kind: 'schema' });
    await expect(lookup({ shell: () => new Response('', { status: 302, headers: { Location: 'https://transaher.es/' } }) }))
      .rejects.toMatchObject({ kind: 'transport' });
    await expect(lookup({ shell: () => new Response('', { status: 404 }) })).rejects.toMatchObject({ kind: 'transport' });
  });

  it('preserves a rate limit on any request', async () => {
    const limited = () => new Response('', { status: 429 });
    await expect(carrier(hub({ polls: [], negotiate: limited }).fetcher).track({ number: DELIVERED })).rejects.toMatchObject({ kind: 'rate_limited' });
    await expect(carrier(hub({ polls: [], shell: limited }).fetcher).track({ number: DELIVERED })).rejects.toMatchObject({ kind: 'rate_limited' });
    await expect(carrier(hub({ polls: [limited] }).fetcher).recognize!(DELIVERED)).rejects.toMatchObject({ kind: 'rate_limited' });
  });

  it('reads a changed or malformed connection as a schema failure', async () => {
    const lookup = (options: Partial<HubOptions>) => carrier(hub({ polls: [], ...options }).fetcher).track({ number: DELIVERED });
    await expect(lookup({ negotiate: () => Response.json({ connectionToken: TOKEN, availableTransports: [{ transport: 'WebSockets', transferFormats: ['Binary'] }] }) }))
      .rejects.toMatchObject({ kind: 'schema' });
    await expect(lookup({ negotiate: () => new Response('<html></html>') })).rejects.toMatchObject({ kind: 'schema' });
    await expect(lookup({ polls: [join(attach(), render(2, new Uint8Array([1, 2, 3])), started())] })).rejects.toMatchObject({ kind: 'schema' });
    await expect(lookup({ polls: [join(attach(), render(2, pageBatch(fixture('delivered.html')).slice(0, -3)))] })).rejects.toMatchObject({ kind: 'schema' });
    await expect(lookup({ polls: [new Uint8Array([0x05, 0x95, 0x01])] })).rejects.toMatchObject({ kind: 'schema' });
    // The page's grid without its rows' three cells.
    const changed = fixture('delivered.html').replace(/<td rowspan="1" colspan="1"><span class="rz-cell-data" title="">ENTREGADO<\/span><\/td>/, '');
    const { fetcher } = hub({ polls: [join(attach(), render(2, pageBatch(changed)), started())] });
    await expect(carrier(fetcher).track({ number: DELIVERED })).rejects.toMatchObject({ kind: 'schema' });
  });

  it('refuses the server’s handshake error', async () => {
    const { fetcher } = hub({ polls: [] });
    fetcher.mockImplementationOnce(async () => new Response(fixture('shell.html')))
      .mockImplementationOnce(async () => Response.json({ connectionToken: TOKEN, availableTransports: [{ transport: 'LongPolling', transferFormats: ['Binary'] }] }))
      .mockImplementationOnce(async () => new Response(new Uint8Array()))
      .mockImplementationOnce(async () => new Response(null))
      .mockImplementationOnce(async () => new Response('{"error":"Requested protocol is not available."}\u001e'));
    await expect(carrier(fetcher).track({ number: DELIVERED })).rejects.toMatchObject({ kind: 'schema' });
  });

  it('binds the page to the requested number through its expedition number', async () => {
    const { fetcher } = hub({ polls: [shipment('delivered.html')] });
    await expect(carrier(fetcher).track({ number: IN_TRANSIT })).rejects.toMatchObject({ kind: 'indeterminate' });
  });

  it('keeps the server’s own failures apart from a missing parcel', async () => {
    const lookup = (polls: HubOptions['polls']) => carrier(hub({ polls }).fetcher).track({ number: DELIVERED });
    await expect(lookup([join(attach(), started(1, 'Circuit could not be started.'))])).rejects.toMatchObject({ kind: 'transport' });
    await expect(lookup([join(attach(), started(3, null))])).rejects.toMatchObject({ kind: 'transport' });
    await expect(lookup([join(attach(), started(), packMessage([7, null]))])).rejects.toMatchObject({ kind: 'transport' });
    await expect(lookup([() => new Response(null, { status: 204 })])).rejects.toMatchObject({ kind: 'transport' });
    await expect(lookup([join(attach(), invocation('JS.Error', ['There was an unhandled exception']))])).rejects.toMatchObject({ kind: 'indeterminate' });
    // A page that never renders an answer.
    await expect(lookup([join(attach(), started())])).rejects.toMatchObject({ kind: 'indeterminate' });
  });

  it('ends a hanging long poll inside the budget', async () => {
    let signal: AbortSignal | undefined;
    const { fetcher } = hub({ polls: [] });
    fetcher.mockImplementationOnce(async () => new Response(fixture('shell.html')))
      .mockImplementationOnce(async () => Response.json({ connectionToken: TOKEN, availableTransports: [{ transport: 'LongPolling', transferFormats: ['Binary'] }] }))
      .mockImplementationOnce((_input, init) => new Promise((_resolve, reject) => {
        signal = init?.signal ?? undefined;
        signal?.addEventListener('abort', () => reject(signal?.reason), { once: true });
      }));
    const started = Date.now();
    await expect(carrier(fetcher).track({ number: DELIVERED }, { budgetMs: 80 })).rejects.toThrow();
    expect(signal?.aborted).toBe(true);
    expect(Date.now() - started).toBeLessThan(2_000);
  });

  it('recognizes a known number and the unknown-number answer, and asks nothing for a number Transaher does not issue', async () => {
    const known = hub({ polls: [shipment('in-transit.html')] });
    await expect(carrier(known.fetcher).recognize!(IN_TRANSIT)).resolves.toEqual({ known: true, lastActivityAt: null });
    const unknown = hub({ polls: [join(attach(), render(2, pageBatch(fixture('not-found.html'))), started())] });
    await expect(carrier(unknown.fetcher).recognize!(UNKNOWN)).resolves.toEqual({ known: false });
    const fetcher = vi.fn<typeof fetch>();
    await expect(carrier(fetcher).recognize!('1030110900700123450000000')).resolves.toEqual({ known: false });
    for (const number of ['203011090070012345000000001', '1030110900700123450000000011', 'SAMPLE103', `103${'0'.repeat(80)}`]) {
      await expect(carrier(fetcher).track({ number }), number).rejects.toMatchObject({ kind: 'invalid_input' });
    }
    await expect(carrier(fetcher).track({ number: DELIVERED }, { signal: AbortSignal.abort(new Error('cancelled')) })).rejects.toThrow('cancelled');
    expect(fetcher).not.toHaveBeenCalled();
    expect(normalizeTransaherNumber(' 1030-1109 0070 0123 4500 0000 001 ')).toBe(DELIVERED);
  });

  it('routes a number filed under Transaher, or detected as one of its numbers, to the adapter', async () => {
    const { fetcher } = hub({ polls: [shipment('delivered.html')] });
    await expect(createTracker({ fetcher, providers: [], env: {} }).track({ number: DELIVERED, carrier: 'transaher' }, { budgetMs: 3000 }))
      .resolves.toMatchObject({ carrier: 'transaher', source: 'transaher', result: { current_stage: 'delivered' } });
    const detected = hub({ polls: [shipment('delivered.html')] });
    await expect(createTracker({ fetcher: detected.fetcher, providers: [], env: {} }).track({ number: DELIVERED }, { budgetMs: 3000 }))
      .resolves.toMatchObject({ carrier: 'transaher', source: 'transaher' });
  });
});

describe('Transaher page', () => {
  const page = (change: (html: string) => string = (html) => html) => `<div class="rz-layout">${change(fixture('delivered.html'))}</div>`;

  it('marks a paged history as truncated, since the grid opens on its oldest page', () => {
    const paged = page((html) => html.replace('</table>', '</table><div class="rz-paginator rz-unselectable-text"><a class="rz-paginator-next">2</a></div>'));
    expect(parseTransaher(paged, DELIVERED)).toMatchObject({ current_stage: 'delivered', history_truncated: true });
  });

  it('keeps the summary alone when the grid has no rows, and drops a masked sender', () => {
    const empty = page((html) => html.replace(/<tbody>[\s\S]*<\/tbody>/,
      '<tbody><tr class="rz-datatable-emptymessage-row"><td class="rz-datatable-emptymessage" colspan="3"><span>No records to display.</span></td></tr></tbody>')
      .replace('TIENDA DE EJEMPLO, S.L.', 'TIE*** DE EJ*****'));
    const result = parseTransaher(empty, DELIVERED);
    expect(result).toMatchObject({ status: 'delivered', current_stage: 'delivered', last_status_text: 'Entregado', summary_only: true, events: [] });
    expect(result).not.toHaveProperty('sender_name');
    expect(result).not.toHaveProperty('last_update_local');
  });

  it('rejects a page it cannot read for certain', () => {
    expect(() => parseTransaher(page((html) => html.replace('04/03/2026', '31/02/2026')), DELIVERED)).toThrow(/invalid scan time/);
    expect(() => parseTransaher(page((html) => html.replace('11:02:45', '11:02')), DELIVERED)).toThrow(/invalid scan time/);
    expect(() => parseTransaher(page((html) => html + html), DELIVERED)).toThrow(/more than one history|repeated summary/);
    expect(() => parseTransaher(page((html) => html.replace('090-70012345', '')), DELIVERED)).toThrow(/without its shipment/);
    expect(() => parseTransaher(page((html) => html.replace('090-70012345', 'Consultar')), DELIVERED)).toThrow(/another shipment/);
    expect(() => parseTransaher(page((html) => html.replace(/>(?:REGISTRADO|SALIDA DE ORIGEN|PEDIR DIA Y HORA DESCARGA|ENTREGADO|EN REPARTO)</g, '><')), DELIVERED))
      .toThrow(/without wording/);
    expect(() => parseTransaher(page((html) => html.replace(/<tbody>[\s\S]*<\/tbody>/, '<tbody></tbody>').replace('Entregado', '')), DELIVERED))
      .toThrow(NoHistoryError);
  });
});

describe('Transaher render batches', () => {
  it('applies each kind of edit as the browser renderer does', () => {
    const page = new RenderedPage();
    page.apply(readRenderBatch(writeBatch({
      frames: [
        { type: 'element', name: 'UL', length: 8 }, { type: 'attribute', name: 'class', value: 'list' },
        { type: 'attribute', name: 'data-x', value: 'old' }, { type: 'attribute', name: 'onclick', value: null },
        { type: 'element', name: 'li', length: 2 }, { type: 'text', text: 'one' },
        { type: 'element', name: 'li', length: 2 }, { type: 'text', text: 'two' },
        { type: 'markup', markup: '<b>m</b>' }, { type: 'element', name: 'br', length: 1 }, { type: 'text', text: 'tail' },
        { type: 'component', length: 1, id: 7 },
      ],
      diffs: [{ componentId: 0, edits: [0, 11, 9, 10, 8].map((reference, sibling) => ({ type: 1, sibling, reference })) },
        { componentId: 7, edits: [{ type: 1, sibling: 0, reference: 5 }] }],
    })));
    expect(page.html(0)).toBe('<ul class="list" data-x="old"><li>one</li><li>two</li></ul>one<br>tail<b>m</b>');
    page.apply(readRenderBatch(writeBatch({
      frames: [{ type: 'text', text: 'uno & <dos>' }, { type: 'attribute', name: 'class', value: 'changed "x"' }, { type: 'markup', markup: '<i>n</i>' }],
      diffs: [{ componentId: 0, edits: [
        { type: 3, sibling: 0, reference: 1 }, { type: 4, sibling: 0, removed: 'data-x' },
        { type: 6, sibling: 0 }, { type: 6, sibling: 0 }, { type: 5, sibling: 0, reference: 0 }, { type: 7 },
        { type: 9, sibling: 0, reference: 1 }, { type: 9, sibling: 1, reference: 0 }, { type: 10 }, { type: 7 },
        { type: 8, sibling: 4, reference: 2 }, { type: 2, sibling: 3 }, { type: 2, sibling: 1 },
      ] }],
      disposed: [7],
    })));
    expect(page.html(0)).toBe('<ul class="changed &quot;x&quot;"><li>two</li><li>uno &amp; &lt;dos&gt;</li></ul><br><i>n</i>');
    expect(page.html(7)).toBe('');
  });

  it('rejects batches that do not fit their own layout', () => {
    expect(() => readRenderBatch(new Uint8Array(12))).toThrow(/malformed render batch/);
    const batch = writeBatch({ frames: [{ type: 'text', text: 'x' }], diffs: [{ componentId: 0, edits: [{ type: 1, sibling: 0, reference: 0 }] }] });
    const broken = batch.slice();
    new DataView(broken.buffer).setInt32(broken.length - 16, broken.length, true);
    expect(() => readRenderBatch(broken)).toThrow(/malformed render batch/);
    const page = new RenderedPage();
    // An edit for a node the component does not have.
    expect(() => page.apply(readRenderBatch(writeBatch({ frames: [{ type: 'text', text: 'x' }],
      diffs: [{ componentId: 0, edits: [{ type: 5, sibling: 3, reference: 0 }] }] })))).toThrow(/malformed render batch/);
    // A component inside itself.
    page.apply(readRenderBatch(writeBatch({ frames: [{ type: 'component', length: 1, id: 0 }],
      diffs: [{ componentId: 0, edits: [{ type: 1, sibling: 0, reference: 0 }] }] })));
    expect(() => page.html(0)).toThrow(/malformed render batch/);
  });

  it('writes the hub messages the official client writes', () => {
    const base64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64');
    expect(base64(packMessage([1, {}, null, 'OnRenderCompleted', [2, null]]))).toBe('GZUBgMCxT25SZW5kZXJDb21wbGV0ZWSSAsA=');
    expect(base64(packMessage([1, {}, null, 'EndInvokeJSFromDotNet', [2, true, '[2,true,false]']])))
      .toBe('LJUBgMC1RW5kSW52b2tlSlNGcm9tRG90TmV0kwLDrlsyLHRydWUsZmFsc2Vd');
    const long = 'x'.repeat(300);
    const bytes = new Uint8Array(70_000).fill(7);
    expect(unpackMessages(join(packMessage([long, bytes, 65_536, { key: [false] }]), packMessage(6)))).toEqual([[long, bytes, 65_536, { key: [false] }], 6]);
    expect(() => unpackMessages(new Uint8Array([0x02, 0x91]))).toThrow(/malformed message/);
  });
});

describe('Transaher numbers', () => {
  it('detects whole 27-digit numbers starting 103 only', () => {
    for (const number of [DELIVERED, IN_TRANSIT, UNKNOWN]) {
      expect(detectCarrierMatch(number), number).toMatchObject({ carrier: 'transaher', confidence: 'high' });
    }
    for (const number of ['10301109007001234500000000', '1030110900700123450000000012', '203011090070012345000000001']) {
      expect(detectCarrierMatch(number).carrier, number).not.toBe('transaher');
    }
  });
});

describe('Transaher status vocabulary', () => {
  it('records every wording the map knows with the stage it gives', () => {
    for (const entry of statuses.entries as { wording: string; stage?: string; unmapped?: boolean }[]) {
      const answer = statusMapAnswer({ carrier: 'transaher', providerCode: null, description: entry.wording });
      if (entry.unmapped) {
        expect(transaherStage(entry.wording), entry.wording).toBeNull();
        expect(answer, entry.wording).toMatchObject({ kind: 'intentional_gap' });
        continue;
      }
      expect(answer, entry.wording).toEqual({ kind: 'mapped', stage: entry.stage });
      expect(transaherStage(entry.wording), entry.wording).toEqual({ stage: entry.stage, source: 'carrier_map' });
    }
    expect(statusMapAnswer({ carrier: 'transaher', providerCode: null, description: 'Synthetic note' })).toEqual({ kind: 'unknown' });
  });
});
