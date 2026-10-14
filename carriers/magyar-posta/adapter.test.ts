import { readFileSync } from 'node:fs';
import { load } from 'cheerio';
import { describe, expect, it, vi } from 'vitest';
import { statusMapAnswer } from '../../core/catalog/statusMaps.js';
import type { TrawlClient } from '../../core/transport/trawl.js';
import { adapter, MAGYAR_POSTA_RESULT, MAGYAR_POSTA_SEARCH, MAGYAR_POSTA_TRACKER, MagyarPostaTracker, magyarPostaTrackingUrl } from './adapter.js';
import { normalizeMagyarPostaNumber, parseMagyarPosta } from './parser.js';
import { magyarPostaStage, statusMap } from './status.js';
import statuses from './statuses.json' with { type: 'json' };

const PARCEL = 'PNZZZ00000013';
const LETTER = 'LZ000000014NL';
const UNKNOWN = 'ZZ000000028HU';
const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}.html`, import.meta.url), 'utf8');
const capture = (overrides: Record<string, unknown> = {}) => ({ url: MAGYAR_POSTA_RESULT, status: 200, headers: {},
  body: fixture('delivered'), truncated: false, base64Encoded: false, error: null, trackingNumberSubmitted: PARCEL, ...overrides });
const searched = (status = 302, error: string | null = null) => ({ url: MAGYAR_POSTA_SEARCH, status, headers: { 'retry-after': '30' },
  body: null, truncated: false, base64Encoded: false, error });
const refused = { url: MAGYAR_POSTA_TRACKER, status: 200, headers: {}, body: null, truncated: false, base64Encoded: false,
  error: 'Google refused the audio challenge' };
const edit = (html: string, change: ($: ReturnType<typeof load>) => void) => { const $ = load(html); change($); return $.html(); };
const tracker = (capturedResponses: unknown[] = [searched(), capture()], statusCode = 200) => {
  const scrape = vi.fn().mockResolvedValue({ tier: 3, statusCode, capturedResponses });
  return { scrape, tracker: new MagyarPostaTracker({ trawl: { scrape } as unknown as TrawlClient }) };
};

describe('Magyar Posta result page', () => {
  it('reads a parcel log as wall clocks, newest first, with categories and stages', () => {
    const result = parseMagyarPosta(fixture('delivered'), PARCEL);
    expect(result).toMatchObject({ status: 'delivered', current_stage: 'delivered', current_stage_source: 'carrier_map',
      last_status_text: 'Sikeres kézbesítés rögzítése belső rendszerben', last_update: null,
      last_update_local: '2026-03-03T13:20:00', service_name: 'Üzleti csomag' });
    expect(result.events!.map(event => [event.local_time, event.provider_code, event.stage])).toEqual([
      ['2026-03-03T13:20:00', '5', 'delivered'],
      ['2026-03-03T13:20:00', '5', 'delivered'],
      ['2026-03-03T07:58:00', '4', 'out_for_delivery'],
      ['2026-03-03T01:05:00', '3', 'in_transit'],
      ['2026-03-02T22:41:00', '1', 'accepted'],
      ['2026-03-02T15:10:00', '1', 'registered'],
    ]);
    expect(result.events![1]).toMatchObject({ description: 'Sikeres kézbesítés rögzítése belső rendszerben',
      location: 'Példavárosi Operatív Osztály, Példaváros' });
    // Who took the item, the cash-on-delivery settlement and a repeated scan stay out.
    expect(JSON.stringify(result)).not.toMatch(/Címzett|Árufizetési/);
    expect(result.events!.some(event => event.time)).toBe(false);
    expect(result.pickup_point).toBeUndefined();
  });

  it('reads a letter, whose placeholder id and unwrapped clocks differ from a parcel, and its pickup office', () => {
    const result = parseMagyarPosta(fixture('pickup'), LETTER);
    expect(result).toMatchObject({ status: 'out_for_delivery', current_stage: 'ready_for_pickup',
      pickup_point: 'Példaváros 1 posta, Példaváros', last_update_local: '2026-04-11T09:00:00' });
    expect(result.service_name).toBeUndefined();
    expect(result.events!.map(event => event.stage)).toEqual(['ready_for_pickup', 'in_transit', 'in_transit', 'in_transit', 'in_transit',
      'customs', 'in_transit', 'customs', 'in_transit', 'in_transit', 'accepted']);
    expect(result.events!.at(-2)).not.toHaveProperty('location');
    // Collected later at the same office.
    const collected = edit(fixture('pickup'), $ => {
      $('div.result_item.closed div.fig_24').attr('class', 'fig_25');
      $('div.more_details_container').append(rowFor('2', '5', 'Sikeresen kézbesítve', '2026. 04. 14. 10:31', 'Példaváros 1 posta|Példaváros'));
    });
    expect(parseMagyarPosta(collected, LETTER)).toMatchObject({ current_stage: 'delivered', pickup_point: 'Példaváros 1 posta, Példaváros' });
  });

  it('reads a delivery after an undeliverable item went back as its return', () => {
    const html = fixture('delivered').replace('fig_14', 'fig_13').replace('A küldemény a kézbesítőnél van', 'A küldemény nem kézbesíthető (nem kereste)');
    const result = parseMagyarPosta(html, PARCEL);
    expect(result).toMatchObject({ status: 'exception', current_stage: 'returned' });
    expect(result.events!.slice(0, 3).map(event => event.stage)).toEqual(['returned', 'returned', 'returned']);
  });

  it('tells a missing number from other answers', () => {
    expect(() => parseMagyarPosta(fixture('not-found'), UNKNOWN)).toThrow(expect.objectContaining({ kind: 'not_found' }));
    const notFound = fixture('not-found');
    for (const [html, number, kind] of [
      [notFound, 'ZZ000000031HU', 'schema'],
      [notFound.replaceAll(UNKNOWN, 'ZZ000000031HU').replace(`value="ZZ000000031HU"`, `value="${UNKNOWN}"`), UNKNOWN, 'indeterminate'],
      [notFound.replace('nem talált adatot', 'nem érhető el'), UNKNOWN, 'indeterminate'],
      [notFound.replace('Eredm&#xE9;nyek', 'Results'), UNKNOWN, 'schema'],
      ['<html><head><title>Request Rejected</title></head><body>The requested URL was rejected.</body></html>', UNKNOWN, 'challenge'],
      ['<html><body>Hiba</body></html>', UNKNOWN, 'schema'],
    ] as const) {
      expect(() => parseMagyarPosta(html, number), `${kind} ${html.length}`).toThrow(expect.objectContaining({ kind }));
    }
  });

  it('binds the search, the item and the log to the whole number', () => {
    const page = fixture('delivered');
    expect(() => parseMagyarPosta(page.replace(`value="${PARCEL}"`, `value="${PARCEL},${LETTER}"`), PARCEL)).toThrow(expect.objectContaining({ kind: 'schema' }));
    expect(() => parseMagyarPosta(page.replace(`data_1 wordwrap">${PARCEL}`, `data_1 wordwrap">${PARCEL}0`), PARCEL)).toThrow(expect.objectContaining({ kind: 'schema' }));
    expect(() => parseMagyarPosta(page.replace(`data1 wordwrap">${PARCEL}`, `data1 wordwrap">PNZZZ00000026`), PARCEL)).toThrow(expect.objectContaining({ kind: 'schema' }));
    const twice = edit(page, $ => { $('div.result_item.opened').after($('div.result_item.closed').clone()); });
    expect(() => parseMagyarPosta(twice, PARCEL)).toThrow(expect.objectContaining({ kind: 'schema' }));
    for (const broken of [page.replace('fig_13', 'fig_19'), page.replace('2026. 03. 03. 1:05', '2026. 03. 03. 01:05:00'),
      page.replace('2026. 03. 03. 1:05', '2026. 02. 30. 1:05')]) {
      expect(() => parseMagyarPosta(broken, PARCEL)).toThrow(expect.objectContaining({ kind: 'schema' }));
    }
  });

  it('keeps an item known by its status alone as a summary', () => {
    const page = fixture('delivered');
    const empty = edit(page, $ => { $('div.more_details_item').remove(); });
    expect(parseMagyarPosta(empty, PARCEL)).toMatchObject({ summary_only: true, current_stage: 'delivered', events: [],
      last_update_local: '2026-03-03T13:20:00' });
  });

  it('accepts the identifiers the tracker takes', () => {
    expect(normalizeMagyarPostaNumber(' pnzzz 0000 0013 ')).toBe(PARCEL);
    expect(magyarPostaTrackingUrl(LETTER)).toBe(`https://www.posta.hu/nyomkovetes/nyitooldal?searchvalue=${LETTER}`);
    for (const value of ['PNZZZ', 'ABCDEFGHIJ', 'PNZZZ00000013?', 'A'.repeat(30) + '1']) {
      expect(() => normalizeMagyarPostaNumber(value)).toThrow(expect.objectContaining({ kind: 'invalid_input' }));
    }
  });
});

describe('Magyar Posta status map', () => {
  it('stages every recorded wording, its category otherwise, and leaves settlements out', () => {
    for (const entry of statuses.entries) {
      const stage = 'stage' in entry ? entry.stage : undefined;
      expect(statusMap.stage(entry.code, entry.wording.toLowerCase()), entry.wording).toBe(stage);
    }
    expect(magyarPostaStage('3', 'Új esemény')).toBe('in_transit');
    expect(magyarPostaStage('4', 'Új esemény')).toBeUndefined();
    expect(magyarPostaStage('9', 'Új esemény')).toBeUndefined();
    expect(magyarPostaStage(null, 'Sikeresen kézbesítve')).toBe('delivered');
    for (const code of ['constructor', '__proto__', 'toString']) expect(magyarPostaStage(code, 'új esemény')).toBeUndefined();
    expect(statusMapAnswer({ carrier: 'magyar-posta', providerCode: '5', description: 'Feladónak visszakézbesítve' }))
      .toEqual({ kind: 'mapped', stage: 'returned' });
    expect(statusMapAnswer({ carrier: 'magyar-posta', providerCode: '5', description: 'Árufizetési összeg feladónak kifizetve' }))
      .toMatchObject({ kind: 'intentional_gap' });
  });
});

describe('Magyar Posta browser search', () => {
  it('asks the browser service for the public page and its bound result within the budget', async () => {
    const { scrape, tracker: active } = tracker();
    expect((await active.fetch(PARCEL, { budgetMs: 40_000 })).current_stage).toBe('delivered');
    const [request, options] = scrape.mock.calls[0]!;
    expect(request).toMatchObject({ url: magyarPostaTrackingUrl(PARCEL), skipHttp: true, maxTier: 3, captureResponses: [MAGYAR_POSTA_RESULT] });
    expect(request.maxTimeout).toBeLessThanOrEqual(38_000);
    expect(options).toMatchObject({ requireSolved: false, captureWindow: 'last', timeoutMs: request.maxTimeout });
    await expect(tracker([searched(), capture({ body: fixture('not-found'), trackingNumberSubmitted: UNKNOWN })]).tracker.fetch(UNKNOWN))
      .rejects.toMatchObject({ kind: 'not_found' });
  });

  it('keeps refusals, limits and failures apart from a missing number', async () => {
    for (const [rows, statusCode, kind] of [
      [[], 200, 'challenge'],
      [[], 429, 'rate_limited'],
      [[], 503, 'maintenance'],
      [[], 404, 'transport'],
      [[searched(200, 'Magyar Posta refused the verification')], 200, 'challenge'],
      [[refused], 200, 'challenge'],
      [[{ ...refused, error: 'other' }], 200, 'challenge'],
      [[searched(429)], 200, 'rate_limited'],
      [[searched(403)], 200, 'challenge'],
      [[searched(500)], 200, 'indeterminate'],
      [[searched()], 200, 'transport'],
      [[searched(), capture({ trackingNumberSubmitted: 'PNZZZ00000026' })], 200, 'transport'],
      [[searched(), capture({ url: `${MAGYAR_POSTA_RESULT}?x` })], 200, 'transport'],
      [[searched(), capture({ status: 502 })], 200, 'indeterminate'],
      [[searched(), capture({ status: 404 })], 200, 'transport'],
      [[searched(), capture({ truncated: true })], 200, 'transport'],
      [[searched(), capture({ body: null })], 200, 'transport'],
      [[searched(), capture({ error: 'Magyar Posta response could not be read' })], 200, 'transport'],
      [[searched(), capture({ body: 'x'.repeat(1_000_001) })], 200, 'schema'],
      [Array.from({ length: 11 }, () => searched()), 200, 'challenge'],
    ] as const) {
      await expect(tracker([...rows], statusCode).tracker.fetch(PARCEL), `${kind} ${JSON.stringify(rows).slice(0, 80)}`)
        .rejects.toMatchObject({ kind });
    }
  });

  it('fails as a challenge without the browser for a while after Google refuses the audio challenge', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    try {
      const { scrape, tracker: active } = tracker([refused]);
      await expect(active.fetch(PARCEL)).rejects.toMatchObject({ kind: 'challenge', reason: 'verification_refused' });
      await expect(active.fetch(UNKNOWN)).rejects.toMatchObject({ kind: 'challenge', reason: 'verification_refused' });
      expect(scrape).toHaveBeenCalledTimes(1);
      now.mockReturnValue(1_000_000 + 10 * 60_000);
      scrape.mockResolvedValue({ tier: 3, statusCode: 200, capturedResponses: [searched(), capture()] });
      expect((await active.fetch(PARCEL)).current_stage).toBe('delivered');
      // An unsolved checkbox is no refusal of the address.
      const unsolved = tracker([]);
      for (let i = 0; i < 2; i++) await expect(unsolved.tracker.fetch(PARCEL)).rejects.toMatchObject({ kind: 'challenge' });
      expect(unsolved.scrape).toHaveBeenCalledTimes(2);
    } finally { now.mockRestore(); }
  });

  it('needs the browser service, a usable number and budget', async () => {
    await expect(new MagyarPostaTracker().fetch(PARCEL)).rejects.toMatchObject({ kind: 'challenge' });
    const { scrape, tracker: active } = tracker();
    await expect(active.fetch('PNZZZ')).rejects.toMatchObject({ kind: 'invalid_input' });
    await expect(active.fetch(PARCEL, { budgetMs: 1500 })).rejects.toMatchObject({ kind: 'budget' });
    expect(scrape).not.toHaveBeenCalled();
    const controller = new AbortController(); controller.abort(new Error('cancelled'));
    await expect(active.fetch(PARCEL, { signal: controller.signal })).rejects.toThrow('cancelled');
  });

  it('declares its browser step', () => {
    const instance = adapter({ trawl: null } as never);
    expect(instance).toMatchObject({ id: 'magyar-posta', steps: ['trawl'], recordsSteps: true });
    expect(instance.recognize).toBeUndefined();
  });
});

function rowFor(tab: string, category: string, wording: string, time: string, place: string): string {
  return `<div class="more_details_item light">\n<div class="status_ikon blue">\n<div class="fig_${tab}${category}"></div>\n</div>\n`
    + `<div class="line_container">\n<div class="data_txt data_more_2"><div>Kézbesített</div></div>\n`
    + `<div class="data_txt data_more_3">\n<div>${wording}<br /><span class="data_sikertelen_atv">Címzett</span></div>\n</div>\n`
    + `<div class="data_txt data_more_1">${time}</div>\n<div class="data_txt data_more_4"><div>${place}</div></div>\n</div>\n</div>\n`;
}
