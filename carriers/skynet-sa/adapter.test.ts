import { readFileSync } from 'node:fs';
import { load } from 'cheerio';
import type { ChildNode } from 'domhandler';
import { describe, expect, it, vi } from 'vitest';
import { statusMapAnswer } from '../../core/catalog/statusMaps.js';
import { detectCarrierMatch } from '../../core/detection/index.js';
import { NoHistoryError } from '../../core/errors/index.js';
import { NOOP_RECORDER } from '../../core/telemetry/index.js';
import { createTracker } from '../../facade/index.js';
import { adapter, SKYNET_SA_HUB, SKYNET_SA_TRACKER, SkynetSaTracker, skynetSaPageUrl } from './adapter.js';
import { componentState, packMessage, readRenderBatch, RenderedPage, serverComponents, unpackMessages, type Frame, type Packed } from './blazor.js';
import { normalizeSkynetSaNumber, parseSkynetSa } from './parser.js';
import { skynetSaStage } from './status.js';
import statuses from './statuses.json' with { type: 'json' };

const DELIVERED = 'ZZ0000000001';
const IN_TRANSIT = 'ZZ0000000002';
const REFERENCE = 'ZZ0000000003';
const LISTED = 'ZZ0000000004';
const UNKNOWN = 'ZZ0000000009';
const TOKEN = 'synthetic-token_1';
const POLL = `${SKYNET_SA_HUB}?id=${TOKEN}`;

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const carrier = (fetcher: typeof fetch) => adapter({ fetcher, recorder: NOOP_RECORDER, env: {}, trawl: null, browserExecutablePath: null });
const join = (...parts: Uint8Array[]) => {
  const bytes = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  parts.reduce((at, part) => (bytes.set(part, at), at + part.length), 0);
  return bytes;
};

// --- A render batch writer, the reverse of ASP.NET Core's layout, for the fake hub.

// ASP.NET Core 8's render mode (9) and named event (10) frames, which take no node.
type TestFrame = Frame | { type: 'raw'; code: 9 | 10 };
type EditSpec = { type: number; sibling?: number; reference?: number; removed?: string };
type BatchSpec = { diffs: { componentId: number; edits: EditSpec[] }[]; frames: TestFrame[]; disposed?: number[] };

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
              : frame.type === 'markup' ? [8, string(frame.markup)]
                : frame.type === 'raw' ? [frame.code] : [6];
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

/**
 * The app's two roots: the layout, holding the page's component with its
 * render mode, which renders the fragment in a region; and the head, which
 * renders the title.
 */
function pageBatch(html: string): Uint8Array {
  const page = framesOf(load(html, null, false).root()[0]!.children);
  return writeBatch({
    frames: [
      { type: 'element', name: 'div', length: 6 }, { type: 'attribute', name: 'class', value: 'container-fluid' }, { type: 'capture' },
      { type: 'raw', code: 10 },
      { type: 'component', length: 2, id: 1 }, { type: 'raw', code: 9 },
      { type: 'region', length: page.length + 1 }, ...page,
      { type: 'element', name: 'title', length: 2 }, { type: 'text', text: 'SkyTrack' },
    ],
    diffs: [{ componentId: 0, edits: [{ type: 1, sibling: 0, reference: 0 }] }, { componentId: 1, edits: [{ type: 1, sibling: 0, reference: 6 }] },
      { componentId: 3, edits: [{ type: 1, sibling: 0, reference: 7 + page.length }] }],
  });
}

// --- The hub's side of the connection.

const invocation = (target: string, args: Packed[]) => packMessage([1, {}, null, target, args, []]);
const attach = () => join(invocation('JS.AttachComponent', [0, '0']), invocation('JS.AttachComponent', [3, '1']));
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
      { transport: 'ServerSentEvents', transferFormats: ['Text'] }, { transport: 'LongPolling', transferFormats: ['Text', 'Binary'] }] }),
  polls }: HubOptions) {
  const queue = [new Uint8Array(), HANDSHAKE_REPLY, ...polls];
  const requests: string[] = [];
  const sent: Packed[] = [];
  const texts: string[] = [];
  const fetcher = vi.fn<typeof fetch>(async (input, init) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    requests.push(`${method} ${url}`);
    if (url.startsWith(`${SKYNET_SA_TRACKER}T?R=`) && method === 'GET') return shell();
    if (url === `${SKYNET_SA_HUB}/negotiate?negotiateVersion=1` && method === 'POST') return negotiate();
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

describe('SkyNet South Africa HTTP adapter', () => {
  it('opens the tracking page’s circuit over long polling, through the supplied transport, and closes it', async () => {
    const { fetcher, requests, sent, texts } = hub({ polls: [shipment('delivered.html')] });
    const recorder = { ...NOOP_RECORDER, step: vi.fn(), lookup: vi.fn() };
    await expect(new SkynetSaTracker({ fetcher, recorder, userAgent: 'SyntheticHost/1.0' }).fetch(' zz00 0000 0001 '))
      .resolves.toMatchObject({ current_stage: 'delivered' });
    const page = `${SKYNET_SA_TRACKER}T?R=${DELIVERED}`;
    expect(requests).toEqual([`GET ${page}`, `POST ${SKYNET_SA_HUB}/negotiate?negotiateVersion=1`, `GET ${POLL}`, `POST ${POLL}`,
      `GET ${POLL}`, `POST ${POLL}`, `GET ${POLL}`, `POST ${POLL}`, `DELETE ${POLL}`]);
    for (const [, init] of fetcher.mock.calls) {
      expect(init).toMatchObject({ redirect: 'manual', signal: expect.any(AbortSignal), headers: { 'User-Agent': 'SyntheticHost/1.0' } });
    }
    // The negotiation posts an empty body, as the server asks for a length.
    expect(fetcher.mock.calls[1]![1]!.body).toBe('');
    expect(texts).toEqual(['{"protocol":"blazorpack","version":1}\u001e']);
    // ASP.NET Core 8's start takes both components without their keys, and the shell's component state.
    expect(sent).toEqual([
      [1, {}, '0', 'StartCircuit', [SKYNET_SA_TRACKER, page, '[{"type":"server","sequence":0,"descriptor":"U3ludGhldGljRGVzY3JpcHRvcg+AA=="},'
        + '{"type":"server","sequence":1,"descriptor":"U3ludGhldGljSGVhZA/BB=="}]', 'U3ludGhldGljU3RhdGU=']],
      [1, {}, null, 'OnRenderCompleted', [2, null]],
    ]);
    expect(recorder.step).toHaveBeenCalledWith(expect.objectContaining({ carrier: 'skynet-sa', step: 'direct', outcome: 'ok' }));
    expect(skynetSaPageUrl(DELIVERED)).toBe(page);
  });

  it('keeps each scan’s wall clock, newest first, and lets the delivery outrank the records filed after it', async () => {
    const { fetcher } = hub({ polls: [shipment('delivered.html')] });
    const result = await carrier(fetcher).track({ number: DELIVERED });
    expect(result).toMatchObject({ status: 'delivered', current_stage: 'delivered', current_stage_source: 'carrier_map',
      last_status_text: 'Delivered', last_update: null, last_update_local: '2026-03-04T15:20:11', expected_delivery: null });
    expect(result.events!.map((event) => [event.local_time, event.stage ?? null, event.description, event.location ?? null])).toEqual([
      // The system's own branch is not a place.
      ['2026-03-04T15:20:11', null, 'POD image scanned', null],
      ['2026-03-04T11:02:45', null, 'POD created', 'Sampleton'],
      ['2026-03-04T11:02:45', 'delivered', 'Delivered', 'Sampleton'],
      ['2026-03-04T07:40:00', null, 'EMAIL : First time parcel out for delivery at Delivery branch', 'Sampleton'],
      ['2026-03-04T07:39:12', 'out_for_delivery', 'Out on Delivery', 'Sampleton'],
      ['2026-03-03T16:10:00', 'failed_attempt', 'Delivery Exception: Company closed', 'Sampleton'],
      // The repeated scan is kept once.
      ['2026-03-03T06:05:30', 'in_transit', 'Received In Branch Sampleton', 'Sampleton'],
      ['2026-03-02T18:00:00', 'accepted', 'Collected by courier', 'Exampleville'],
      ['2026-03-02T09:15:00', 'registered', 'Created waybill', 'Exampleville'],
    ]);
    expect(result.events!.every((event) => event.time === undefined)).toBe(true);
    expect(result).not.toHaveProperty('history_truncated');
    // The references and the page's chrome are not kept.
    expect(JSON.stringify(result)).not.toMatch(/SAMPLE-1|REFERENCES|HostServer|SkyTrack|Contact/);
  });

  it('reads an inbound parcel’s airport, customs and dispatch scans', async () => {
    const { fetcher } = hub({ polls: [shipment('in-transit.html')] });
    const result = await carrier(fetcher).track({ number: IN_TRANSIT });
    expect(result).toMatchObject({ status: 'in_transit', current_stage: 'in_transit', current_stage_source: 'carrier_map',
      last_status_text: 'Dispatch from airport', last_update: null, last_update_local: '2026-03-07T09:00:00', expected_delivery: null });
    expect(result.events!.map((event) => [event.description, event.stage ?? null])).toEqual([
      ['Dispatch from airport', 'in_transit'], ['Released From Customs', 'in_transit'], ['Rec cust agent', 'customs'],
      ['Scan into branch', 'in_transit'], ['Received from airline', 'in_transit'], ['In-house-client scan', 'in_transit'],
      ['Flight landed', 'in_transit'], ['Customs Duties Paid', null], ['Created waybill', 'registered'],
    ]);
    expect(result.events![0]).toEqual({ local_time: '2026-03-07T09:00:00', location: 'Exampleville Airport', description: 'Dispatch from airport',
      stage: 'in_transit', stage_source: 'carrier_map' });
    expect(JSON.stringify(result)).not.toContain('C0001');
  });

  it('reads the not-found line once the page has opened, not while it loads', async () => {
    const { fetcher, requests } = hub({ polls: [join(attach(), render(2, pageBatch(fixture('not-found.html')))), started()] });
    await expect(carrier(fetcher).track({ number: UNKNOWN })).rejects.toMatchObject({ kind: 'not_found' });
    expect(requests.filter((request) => request === `GET ${POLL}`)).toHaveLength(4);
    expect(requests.at(-1)).toBe(`DELETE ${POLL}`);
  });

  it('renders the batches that replace the page’s empty state', async () => {
    const loading = writeBatch({ frames: [{ type: 'element', name: 'div', length: 2 }, { type: 'component', length: 1, id: 1 },
      { type: 'text', text: 'TRACKING INFORMATION' }], diffs: [{ componentId: 0, edits: [{ type: 1, sibling: 0, reference: 0 }] },
      { componentId: 1, edits: [{ type: 1, sibling: 0, reference: 2 }] }] });
    const page = framesOf(load(fixture('in-transit.html'), null, false).root()[0]!.children);
    const loaded = writeBatch({ frames: [{ type: 'region', length: page.length + 1 }, ...page],
      diffs: [{ componentId: 1, edits: [{ type: 2, sibling: 0 }, { type: 1, sibling: 0, reference: 0 }] }] });
    const { fetcher, sent } = hub({ polls: [join(attach(), render(2, loading), started()), render(3, loaded)] });
    await expect(carrier(fetcher).track({ number: IN_TRANSIT })).resolves.toMatchObject({ current_stage: 'in_transit' });
    expect(sent.slice(1)).toEqual([[1, {}, null, 'OnRenderCompleted', [2, null]], [1, {}, null, 'OnRenderCompleted', [3, null]]]);
  });

  it('answers the page’s widget calls and refuses a move to another page', async () => {
    const { fetcher, sent } = hub({ polls: [join(attach(), callJs(4, 'import', ['./_content/DevExpress.Blazor/synthetic.js']), started()),
      join(callJs(5, 'DxBlazor.Input.loadModule', []), render(2, pageBatch(fixture('delivered.html'))))] });
    await expect(carrier(fetcher).track({ number: DELIVERED })).resolves.toMatchObject({ current_stage: 'delivered' });
    expect(sent.slice(1)).toEqual([
      [1, {}, null, 'EndInvokeJSFromDotNet', [4, true, '[4,true,null]']],
      [1, {}, null, 'EndInvokeJSFromDotNet', [5, true, '[5,true,null]']],
      [1, {}, null, 'OnRenderCompleted', [2, null]],
    ]);
    const moved = hub({ polls: [join(attach(), callJs(4, 'Blazor._internal.navigationManager.navigateTo', [`${SKYNET_SA_TRACKER}`, false]))] });
    await expect(carrier(moved.fetcher).track({ number: DELIVERED })).rejects.toMatchObject({ kind: 'schema' });
  });

  it('tells a browser check and a refusal from a missing parcel', async () => {
    const lookup = (options: Partial<HubOptions>) => carrier(hub({ polls: [], ...options }).fetcher).track({ number: DELIVERED });
    await expect(lookup({ shell: () => new Response('<html><title>Just a moment...</title></html>', { status: 403 }) }))
      .rejects.toMatchObject({ kind: 'challenge' });
    await expect(lookup({ shell: () => new Response('<html><head><title>Just a moment...</title></head><body><div id="cf-turnstile"></div></body></html>') }))
      .rejects.toMatchObject({ kind: 'challenge' });
    await expect(lookup({ shell: () => new Response('<html><title>SkyTrack</title></html>') })).rejects.toMatchObject({ kind: 'schema' });
    await expect(lookup({ shell: () => new Response('', { status: 302, headers: { Location: 'https://www.skynet.co.za/' } }) }))
      .rejects.toMatchObject({ kind: 'transport' });
    await expect(lookup({ shell: () => new Response('', { status: 404 }) })).rejects.toMatchObject({ kind: 'transport' });
  });

  it('preserves a rate limit on any request', async () => {
    const limited = () => new Response('', { status: 429 });
    await expect(carrier(hub({ polls: [], shell: limited }).fetcher).track({ number: DELIVERED })).rejects.toMatchObject({ kind: 'rate_limited' });
    await expect(carrier(hub({ polls: [], negotiate: limited }).fetcher).track({ number: DELIVERED })).rejects.toMatchObject({ kind: 'rate_limited' });
    await expect(carrier(hub({ polls: [limited] }).fetcher).track({ number: DELIVERED })).rejects.toMatchObject({ kind: 'rate_limited' });
  });

  it('reads a changed or malformed connection as a schema failure', async () => {
    const lookup = (options: Partial<HubOptions>) => carrier(hub({ polls: [], ...options }).fetcher).track({ number: DELIVERED });
    await expect(lookup({ negotiate: () => Response.json({ connectionToken: TOKEN, availableTransports: [{ transport: 'WebSockets', transferFormats: ['Binary'] }] }) }))
      .rejects.toMatchObject({ kind: 'schema' });
    await expect(lookup({ negotiate: () => Response.json({ connectionToken: 'not a token', availableTransports: [{ transport: 'LongPolling', transferFormats: ['Binary'] }] }) }))
      .rejects.toMatchObject({ kind: 'schema' });
    await expect(lookup({ negotiate: () => new Response('<html></html>') })).rejects.toMatchObject({ kind: 'schema' });
    await expect(lookup({ polls: [join(attach(), render(2, new Uint8Array([1, 2, 3])), started())] })).rejects.toMatchObject({ kind: 'schema' });
    await expect(lookup({ polls: [join(attach(), render(2, pageBatch(fixture('delivered.html')).slice(0, -3)))] })).rejects.toMatchObject({ kind: 'schema' });
    await expect(lookup({ polls: [new Uint8Array([0x05, 0x95, 0x01])] })).rejects.toMatchObject({ kind: 'schema' });
    await expect(lookup({ polls: [join(invocation('JS.AttachComponent', ['0', '0']), started())] })).rejects.toMatchObject({ kind: 'schema' });
    // A history row without its branch.
    const changed = fixture('delivered.html').replace(/<td style="padding: 6px !important;">Exampleville<\/td>/, '');
    await expect(lookup({ polls: [join(attach(), render(2, pageBatch(changed)), started())] })).rejects.toMatchObject({ kind: 'schema' });
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

  it('binds the page to the requested waybill, not to another lookup or a shipment it is a reference of', async () => {
    // The answer for another number.
    await expect(carrier(hub({ polls: [shipment('delivered.html')] }).fetcher).track({ number: IN_TRANSIT })).rejects.toMatchObject({ kind: 'indeterminate' });
    // The number found only as other shipments' reference.
    const referenced = hub({ polls: [shipment('reference.html')] });
    await expect(carrier(referenced.fetcher).track({ number: REFERENCE })).rejects.toMatchObject({ kind: 'indeterminate' });
    // A waybill listed with another one keeps its own scans alone.
    const listed = fixture('reference.html').replace(`${REFERENCE} DETAILS:`, `${LISTED} DETAILS:`);
    const { fetcher } = hub({ polls: [join(attach(), render(2, pageBatch(listed)), started())] });
    const result = await carrier(fetcher).track({ number: LISTED });
    expect(result).toMatchObject({ current_stage: 'delivered', last_update_local: '2026-03-08T12:00:00' });
    expect(result.events!.map((event) => event.description)).toEqual(['Delivered', 'Created waybill']);
    expect(JSON.stringify(result)).not.toMatch(/INVENTED|MADEUP|ZZ0000000003|Out on Delivery/);
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
    const begun = Date.now();
    await expect(carrier(fetcher).track({ number: DELIVERED }, { budgetMs: 80 })).rejects.toThrow();
    expect(signal?.aborted).toBe(true);
    expect(Date.now() - begun).toBeLessThan(2_000);
  });

  it('asks nothing for a number SkyNet does not issue, and offers no recognition', async () => {
    const fetcher = vi.fn<typeof fetch>();
    for (const number of ['ZZ001', 'ZZ00000000000000000001', 'ZZZZZZZZ', 'ZZ/0001', `ZZ${'0'.repeat(80)}`]) {
      await expect(carrier(fetcher).track({ number }), number).rejects.toMatchObject({ kind: 'invalid_input' });
    }
    await expect(carrier(fetcher).track({ number: DELIVERED }, { signal: AbortSignal.abort(new Error('cancelled')) })).rejects.toThrow('cancelled');
    expect(fetcher).not.toHaveBeenCalled();
    expect(carrier(fetcher).recognize).toBeUndefined();
    expect(normalizeSkynetSaNumber(' zz-0000 0000.01 ')).toBe(DELIVERED);
  });

  it('routes a number filed under SkyNet South Africa to the adapter, and claims none by shape', async () => {
    const { fetcher } = hub({ polls: [shipment('delivered.html')] });
    await expect(createTracker({ fetcher, providers: [], env: {} }).track({ number: DELIVERED, carrier: 'skynet-sa' }, { budgetMs: 3000 }))
      .resolves.toMatchObject({ carrier: 'skynet-sa', source: 'skynet-sa', result: { current_stage: 'delivered' } });
    for (const number of [DELIVERED, '000000000001', 'R000000000001']) expect(detectCarrierMatch(number).carrier, number).not.toBe('skynet-sa');
  });
});

describe('SkyNet South Africa page', () => {
  const page = (change: (html: string) => string = (html) => html, name = 'delivered.html') => change(fixture(name));

  it('falls back to the shared wording rules and marks a long history as truncated', () => {
    const rows = Array.from({ length: 101 }, (_, index) => `<tr><td>01/03/2026</td><td>12:${String(Math.floor(index / 60)).padStart(2, '0')}:${String(index % 60).padStart(2, '0')}</td>`
      + '<td>Scan into branch</td><td>Sampleton</td></tr>').join('');
    const long = parseSkynetSa(page((html) => html.replace(/(<tbody>)[\s\S]*(<\/tbody>)/, `$1${rows}$2`)), DELIVERED);
    expect(long).toMatchObject({ current_stage: 'in_transit', history_truncated: true });
    expect(long.events).toHaveLength(100);
    const worded = parseSkynetSa(page((html) => html.replace('POD image scanned', 'Parcel out for delivery')), DELIVERED);
    expect(worded.events![0]).toMatchObject({ description: 'Parcel out for delivery', stage: 'out_for_delivery' });
    expect(worded).toMatchObject({ current_stage: 'out_for_delivery', last_status_text: 'Parcel out for delivery' });
    const unworded = parseSkynetSa(page((html) => html.replace('POD image scanned', 'Synthetic note')), DELIVERED);
    expect(unworded.events![0]).not.toHaveProperty('stage');
  });

  it('keeps a waybill listed twice with the same scans, and refuses one listed with different scans', () => {
    const block = (html: string) => /<hr[\s\S]*<\/table>\s*<\/div>\n/.exec(html)![0];
    const twice = page((html) => html.replace(block(html), block(html) + block(html)));
    expect(parseSkynetSa(twice, DELIVERED)).toMatchObject({ current_stage: 'delivered' });
    const differing = page((html) => html.replace(block(html), block(html) + block(html).replace('Created waybill', 'Scan into branch')));
    expect(() => parseSkynetSa(differing, DELIVERED)).toThrow(/twice with different scans/);
  });

  it('rejects a page it cannot read for certain', () => {
    expect(() => parseSkynetSa(page((html) => html.replace('04/03/2026', '31/02/2026')), DELIVERED)).toThrow(/invalid scan time/);
    expect(() => parseSkynetSa(page((html) => html.replace('07:39:12', '07:39')), DELIVERED)).toThrow(/invalid scan time/);
    expect(() => parseSkynetSa(page((html) => html.replace('</table>', '</table><table></table>')), DELIVERED)).toThrow(/more than one history/);
    expect(() => parseSkynetSa(page((html) => html.replace('>Branch<', '>Depot<')), DELIVERED)).toThrow(/changed history/);
    expect(() => parseSkynetSa(page((html) => html.replace(/WAYBILL NUMBER: \w+/, 'WAYBILL')), DELIVERED)).toThrow(/without their waybill/);
    expect(() => parseSkynetSa(page((html) => html.replace(/<hr[\s\S]*<\/div>\n(?=\s*<\/div>\s*<div)/, '')), DELIVERED)).toThrow(/without a waybill/);
    expect(() => parseSkynetSa(page((html) => html.replace('</i> Delivered<', '</i> <')), DELIVERED)).toThrow(/without wording/);
    expect(() => parseSkynetSa(page((html) => html.replace(`${DELIVERED} DETAILS:`, 'DETAILS')), DELIVERED)).toThrow(/without an answer/);
    expect(() => parseSkynetSa(page((html) => html.replace(/<tbody>[\s\S]*<\/tbody>/, '<tbody></tbody>')), DELIVERED)).toThrow(NoHistoryError);
    expect(() => parseSkynetSa(page((html) => html.replace(/<div class="row"[\s\S]*<\/table>\s*<\/div>/, '')), DELIVERED)).toThrow(NoHistoryError);
  });
});

describe('SkyNet South Africa render batches', () => {
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

  it('reads ASP.NET Core 8’s render mode and named event frames as frames without a node', () => {
    const page = new RenderedPage();
    page.apply(readRenderBatch(writeBatch({
      frames: [{ type: 'element', name: 'form', length: 3 }, { type: 'raw', code: 10 }, { type: 'text', text: 'x' },
        { type: 'component', length: 2, id: 4 }, { type: 'raw', code: 9 }],
      diffs: [{ componentId: 0, edits: [{ type: 1, sibling: 0, reference: 0 }, { type: 1, sibling: 1, reference: 3 }] }],
    })));
    expect(page.html(0)).toBe('<form>x</form>');
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

  it('reads the shell’s components and state, and writes the hub messages the official client writes', () => {
    const shell = fixture('shell.html');
    expect(serverComponents(shell)).toEqual([{ type: 'server', sequence: 0, descriptor: 'U3ludGhldGljRGVzY3JpcHRvcg+AA==' },
      { type: 'server', sequence: 1, descriptor: 'U3ludGhldGljSGVhZA/BB==' }]);
    expect(componentState(shell)).toBe('U3ludGhldGljU3RhdGU=');
    expect(componentState('<html></html>')).toBe('');
    const base64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64');
    expect(base64(packMessage([1, {}, null, 'OnRenderCompleted', [2, null]]))).toBe('GZUBgMCxT25SZW5kZXJDb21wbGV0ZWSSAsA=');
    const long = 'x'.repeat(300);
    const bytes = new Uint8Array(70_000).fill(7);
    expect(unpackMessages(join(packMessage([long, bytes, 65_536, { key: [false] }]), packMessage(6)))).toEqual([[long, bytes, 65_536, { key: [false] }], 6]);
    expect(() => unpackMessages(new Uint8Array([0x02, 0x91]))).toThrow(/malformed message/);
  });
});

describe('SkyNet South Africa status vocabulary', () => {
  it('records every wording the map knows with the stage it gives', () => {
    for (const entry of statuses.entries as { wording: string; stage?: string; unmapped?: boolean }[]) {
      const answer = statusMapAnswer({ carrier: 'skynet-sa', providerCode: null, description: entry.wording });
      if (entry.unmapped) {
        expect(skynetSaStage(entry.wording), entry.wording).toBeNull();
        expect(answer, entry.wording).toMatchObject({ kind: 'intentional_gap' });
        continue;
      }
      expect(answer, entry.wording).toEqual({ kind: 'mapped', stage: entry.stage });
      expect(skynetSaStage(entry.wording), entry.wording).toEqual({ stage: entry.stage, source: 'carrier_map' });
    }
    expect(statusMapAnswer({ carrier: 'skynet-sa', providerCode: null, description: 'Synthetic note' })).toEqual({ kind: 'unknown' });
  });
});
