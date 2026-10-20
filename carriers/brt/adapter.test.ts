import { readFileSync } from 'node:fs';
import { load } from 'cheerio';
import { describe, expect, it, vi } from 'vitest';
import { normalizeCarrierResult, type CarrierEvent, type CarrierResult } from '../../core/result/index.js';
import { BrtTracker, adapter, type BrtOriginLookup } from './adapter.js';
import { brtOriginPartner, normalizeBrtNumber, parseBrt, withOriginLeg } from './parser.js';
import { classifyBrtStatus } from './status.js';
import statuses from './statuses.json' with { type: 'json' };
import { IndeterminateError, InvalidInputError, NoHistoryError } from '../../core/errors/index.js';

const NUMBER = '99000000000002';
const OTHER = '99000000000003';
const SHIPMENT = '990000000001';
const html = readFileSync(new URL('./fixtures/history.html', import.meta.url), 'utf8');
const PARCEL_ID = '990991000000015';
const parcelPage = readFileSync(new URL('./fixtures/parcel-id.html', import.meta.url), 'utf8');
const parcelList = readFileSync(new URL('./fixtures/parcel-list.html', import.meta.url), 'utf8');
const notFoundPage = readFileSync(new URL('./fixtures/not-found.html', import.meta.url), 'utf8');
const negative = (number = NUMBER) => `<div id="box_tool_content"><div id="toolbar_sx"><h3>Rintraccia</h3></div><h3 class="separatore">Errori riscontrati</h3><div id="box_contenuti">TIS0868 Parcel Label number ${number} not found</div></div>`;
const changed = (page: string, fn: (document: ReturnType<typeof load>) => void) => { const $ = load(page); fn($); return $.html(); };
const edit = (fn: (document: ReturnType<typeof load>) => void) => changed(html, fn);
const response = (body = html) => new Response(body, { headers: { 'Content-Type': 'text/html; charset=UTF-8' } });
const environment = (fetcher: typeof fetch) => ({ fetcher, env: {}, trawl: null, browserExecutablePath: null, recorder: { step() {}, lookup() {} } });
// Each scan's instant, else its wall clock marked local, else its provider text.
const clocks = (events: ReturnType<typeof parseBrt>['events']) =>
  events!.map(event => event.time ?? (typeof event.local_time === 'string' ? `local ${event.local_time}` : event.provider_time_text));

describe('BRT direct tracking', () => {
  it('projects actual locker scans, Italian depot instants, cross-border local clocks and explicit kilogram weight', () => {
    const result = normalizeCarrierResult(parseBrt(html, NUMBER));
    expect(result).toMatchObject({ status: 'delivered', current_stage: 'delivered', last_status_text: 'Delivered',
      last_update: '2026-01-16T21:07:00+01:00', delivered_at: '2026-01-16T21:07:00+01:00', weight_kg: 0.2 });
    expect(result.last_update_local).toBeUndefined();
    expect(result.events).toHaveLength(7);
    expect(result.events?.[0]).toMatchObject({ stage: 'delivered', description: 'Delivered', time: '2026-01-16T21:07:00+01:00', location: 'TEST DEPOT (990)' });
    expect(result.events?.[1]!.stage).toBe('ready_for_pickup');
    expect(result.events?.[2]).toMatchObject({ stage: 'out_for_delivery', provider_time_text: '14.01.2026' });
    expect(result.events?.[2]!.local_time).toBeUndefined();
    expect(result.events?.[5]!.stage).toBe('accepted');
    expect(result.events?.[6]!.stage).toBe('registered');
    // The Italian depot's scans are on Rome's clock; the depot abroad, named after a country on another clock, keeps wall clocks.
    expect(clocks(result.events)).toEqual(['2026-01-16T21:07:00+01:00', '2026-01-14T15:49:00+01:00', '14.01.2026', '2026-01-14T08:32:00+01:00',
      'local 2026-01-13T21:00:00', 'local 2026-01-13T18:00:00', 'local 2026-01-10T14:57:00']);
    expect(result.events?.every(event => !event.provider_code)).toBe(true);
    expect(JSON.stringify(result)).not.toContain('PRIVATE_SYNTHETIC');
    for (const entry of statuses.entries) expect(classifyBrtStatus(entry.wording)?.stage).toBe(entry.stage);
    for (const word of ['constructor', 'toString', 'DELIVERY PLANNED', 'RETURN REQUESTED']) expect(classifyBrtStatus(word)).toBeUndefined();
  });

  it('binds the returned BRTcode, rejects ambiguous details and accepts only the supported format', () => {
    expect(normalizeBrtNumber('9900 0000 0000 02')).toBe(NUMBER);
    expect(normalizeBrtNumber(PARCEL_ID)).toBe(PARCEL_ID);
    for (const n of ['', '123', NUMBER + '00', NUMBER.slice(1), NUMBER + '?', 'ABC00000000000']) expect(() => normalizeBrtNumber(n)).toThrow(InvalidInputError);
    for (const body of [edit($ => $('.table_dati_spedizione tr').eq(1).children('td').last().text(OTHER)),
      edit($ => $('.table_dati_spedizione tr').eq(1).remove()),
      edit($ => $('.table_dati_spedizione tr').eq(1).clone().appendTo('.table_dati_spedizione')),
      edit($ => $('.table_dati_spedizione').clone().appendTo('body')),
      edit($ => $('.table_stato_dati').clone().appendTo('body'))]) {
      expect(() => parseBrt(body, NUMBER)).toThrowError(expect.objectContaining({ kind: 'schema' }));
    }
  });

  it('keeps shipment numbers separate from BRTcodes and binds the complete identifier', async () => {
    const shipmentHtml = edit($ => {
      const identity = $('.table_dati_spedizione tr').eq(1).children('td');
      identity.first().text('N. spedizione'); identity.last().text(SHIPMENT);
    });
    const fetcher = vi.fn<typeof fetch>(async (url, init) => {
      expect(String(url)).toBe('https://vas.brt.it/vas/sped_det_show.hsm?lang=en');
      expect(init?.method).toBe('POST');
      expect(new Headers(init?.headers).get('content-type')).toBe('application/x-www-form-urlencoded');
      expect(Object.fromEntries(new URLSearchParams(String(init?.body)))).toEqual({ Nspediz: SHIPMENT,
        referer: 'sped_numspe_par.htm', RicercaNumeroSpedizione: 'Ricerca', lang: 'en' });
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      return response(shipmentHtml);
    });
    expect(await adapter(environment(fetcher)).recognize!(SHIPMENT)).toEqual({ known: true, lastActivityAt: '2026-01-16T20:07:00.000Z' });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(() => parseBrt(shipmentHtml.replace(SHIPMENT, '990000000002'), SHIPMENT)).toThrowError(expect.objectContaining({ kind: 'schema' }));
    expect(() => parseBrt(shipmentHtml.replace('N. spedizione', 'BRTcode'), SHIPMENT)).toThrowError(expect.objectContaining({ kind: 'schema' }));
    expect(() => parseBrt(shipmentHtml + shipmentHtml, SHIPMENT)).toThrowError(expect.objectContaining({ kind: 'schema' }));
    expect(() => parseBrt(negative(SHIPMENT), SHIPMENT)).toThrowError(expect.objectContaining({ kind: 'indeterminate' }));
    expect(() => normalizeBrtNumber(SHIPMENT + '0')).toThrow(InvalidInputError);
  });

  it('follows a parcel ID through the parcel list that names it', async () => {
    const fetcher = vi.fn<typeof fetch>(async (url, init) => {
      if (fetcher.mock.calls.length === 1) {
        expect(String(url)).toBe('https://vas.brt.it/vas/sped_det_show.hsm?lang=en');
        expect(init?.method).toBe('POST');
        expect(Object.fromEntries(new URLSearchParams(String(init?.body)))).toEqual({ referer: 'sped_numspe_par.htm', ChiSono: PARCEL_ID,
          ClienteMittente: '', DataInizio: '', DataFine: '', RicercaChiSono: 'Ricerca', lang: 'en' });
        return response(parcelPage);
      }
      expect(String(url)).toBe('https://vas.brt.it/vas/sped_colli_lista.htm?nspediz=990000000001&KSU=&SpeChkCde=123456789&AnnoSpedizione=2026&lang=en');
      expect(init?.method).toBeUndefined();
      return response(parcelList);
    });
    const result = normalizeCarrierResult(await new BrtTracker({ fetcher }).fetch(PARCEL_ID));
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ status: 'delivered', current_stage: 'delivered', last_status_text: 'Delivered', weight_kg: 1 });
    expect(result.events?.map(event => event.stage)).toEqual(['delivered', 'ready_for_pickup', 'failed_attempt', 'out_for_delivery',
      'in_transit', 'in_transit', 'accepted', 'registered']);
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE_SYNTHETIC|SpeChkCde|123456789|990000000001/);
  });

  it('refuses a parcel ID its parcel list does not name, and never follows another shipment\'s list', async () => {
    const twice = (detail: string, list = parcelList) => vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response(detail)).mockResolvedValueOnce(response(list));
    for (const [detail, list] of [
      [parcelPage, parcelList.replaceAll(PARCEL_ID, '990991000000016')],
      [parcelPage, parcelList.replace('ID collo cliente', 'Something else')],
      [parcelPage.replace('sped_colli_lista.htm?nspediz=990000000001', 'sped_colli_lista.htm?nspediz=990000000002'), parcelList],
      [parcelPage.replace('sped_colli_lista.htm', 'https://example.invalid/sped_colli_lista.htm'), parcelList],
      [parcelPage.replace('id="aColli"', 'id="aOther"'), parcelList],
    ]) {
      await expect(new BrtTracker({ fetcher: twice(detail!, list) }).fetch(PARCEL_ID)).rejects.toMatchObject({ kind: 'schema' });
    }
    expect(() => parseBrt(parcelPage, PARCEL_ID)).toThrowError(expect.objectContaining({ kind: 'schema' }));
    // The parcel ID search gives its not-found reply without BRT's error code.
    const absent = vi.fn<typeof fetch>().mockResolvedValue(response(notFoundPage.replace('TIS0564 ', '')));
    await expect(new BrtTracker({ fetcher: absent }).fetch(PARCEL_ID)).rejects.toMatchObject({ kind: 'indeterminate', reason: 'portal_not_found' });
    expect(absent).toHaveBeenCalledTimes(1);
  });

  it('follows an EOB customer parcel ID through the same parcel search', async () => {
    const customerId = 'EOB99099100000000015';
    const list = parcelList.replace(`<td>${PARCEL_ID}</td></tr>`, `<td>${customerId}</td></tr>`);
    expect(normalizeBrtNumber('eob 9909 9100 0000 0001 5')).toBe(customerId);
    for (const n of [customerId.slice(0, -1), customerId + '0', 'EOC99099100000000015', 'EOB9909910000000001A']) {
      expect(() => normalizeBrtNumber(n)).toThrow(InvalidInputError);
    }
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response(parcelPage)).mockResolvedValueOnce(response(list));
    const result = await new BrtTracker({ fetcher }).fetch(customerId);
    expect(Object.fromEntries(new URLSearchParams(String(fetcher.mock.calls[0]![1]?.body)))).toMatchObject({ ChiSono: customerId, RicercaChiSono: 'Ricerca' });
    expect(result).toMatchObject({ status: 'delivered', current_stage: 'delivered' });
    // The list must name this customer ID, and BRT's code-less negative stays inconclusive.
    const other = vi.fn<typeof fetch>().mockResolvedValueOnce(response(parcelPage)).mockResolvedValueOnce(response(parcelList));
    await expect(new BrtTracker({ fetcher: other }).fetch(customerId)).rejects.toMatchObject({ kind: 'schema' });
    const absent = vi.fn<typeof fetch>().mockResolvedValue(response(notFoundPage.replace('TIS0564 ', '')));
    await expect(new BrtTracker({ fetcher: absent }).fetch(customerId)).rejects.toMatchObject({ kind: 'indeterminate', reason: 'portal_not_found' });
  });

  it('reads the shipment past a held-parcel record and a DPD link box', () => {
    const result = parseBrt(parcelPage, '990000000001');
    expect(result).toMatchObject({ status: 'delivered', current_stage: 'delivered', weight_kg: 1 });
    expect(result.events).toHaveLength(8);
    expect(() => parseBrt(parcelPage.replace('N. Giacenza', 'N. spedizione'), '990000000001'))
      .toThrowError(expect.objectContaining({ kind: 'schema' }));
  });

  it('reads a shipment delivered back to its sender as returned', () => {
    const body = edit($ => {
      $('.table_stato_dati tr').eq(1).children('td').last().text('DELIVERED');
      $('.table_stato_dati tr').eq(2).children('td').last().text('RETURNED TO SENDER');
    });
    const result = parseBrt(body, NUMBER);
    expect(result).toMatchObject({ status: 'exception', current_stage: 'returned', last_status_text: 'Delivered', last_update: '2026-01-16T21:07:00+01:00' });
    expect(result.delivered_at).toBeUndefined();
  });

  it('reads a shipment a public demonstration holds up as an exception, until a later scan moves it on', () => {
    const held = parseBrt(edit($ => $('.table_stato_dati tr').eq(1).children('td').last().text('TURMOIL')), NUMBER);
    expect(held).toMatchObject({ status: 'exception', current_stage: 'exception', last_status_text: 'TURMOIL' });
    expect(held.events![0]).toMatchObject({ stage: 'exception', provider_status: 'TURMOIL' });
    const moved = parseBrt(edit($ => {
      $('.table_stato_dati tr').eq(1).children('td').last().text('ARRIVED AT DEPOT');
      $('.table_stato_dati tr').eq(2).children('td').last().text('TURMOIL');
    }), NUMBER);
    expect(moved).toMatchObject({ status: 'in_transit', current_stage: 'in_transit' });
    expect(moved.events![1]).toMatchObject({ stage: 'exception' });
  });

  it('dates a shipment delivered in Italy on Rome\'s clock at each of BRT\'s depots, and its last update by the newest scan', () => {
    // Collected and delivered in Italy, in summer time.
    const result = parseBrt(parcelPage, SHIPMENT);
    expect(result).toMatchObject({ status: 'delivered', last_update: '2026-09-04T12:38:00+02:00', delivered_at: '2026-09-04T12:38:00+02:00' });
    expect(result.last_update_local).toBeUndefined();
    expect(clocks(result.events)).toEqual(['2026-09-04T12:38:00+02:00', '2026-09-03T12:59:00+02:00', '2026-09-02T15:21:00+02:00', '02.09.2026',
      '2026-09-02T08:32:00+02:00', '2026-09-01T21:00:00+02:00', '2026-09-01T18:00:00+02:00', '2026-08-27T14:31:00+02:00']);
    // On its way, the newest scan's instant is the last update, without a delivery.
    const moving = parseBrt(changed(parcelPage, $ => $('.table_stato_dati').first().find('tr').slice(1, 5).remove()), SHIPMENT);
    expect(moving).toMatchObject({ status: 'in_transit', current_stage: 'in_transit', last_update: '2026-09-02T08:32:00+02:00' });
    expect(moving.last_update_local).toBeUndefined(); expect(moving.delivered_at).toBeUndefined();
  });

  it('keeps wall clocks at the DPD network\'s depots abroad and at places that are not BRT depots', () => {
    const at = (place: string) => parseBrt(edit($ => $('.table_stato_dati tr').eq(1).children('td').eq(2).text(place)), NUMBER);
    for (const place of ['DPD-XX IMPORT TEST (991)', 'DPD XX NORD (992)', 'DPD SAMPLE NORDICS (993)', 'DPD IRLANDA (994)',
      'SAMPLE REGNO UNITO (996)', 'PORTOGALLO/SPAGNA (997)', 'DPD STATI UNITI (998)', '', 'TEST DEPOT', 'TEST DEPOT (99)', 'TEST DEPOT (9900)']) {
      const result = at(place);
      expect(result, place).toMatchObject({ status: 'delivered', last_update: null, last_update_local: '2026-01-16T21:07:00' });
      expect(result.delivered_at, place).toBeUndefined();
      expect(result.events![0]!.time, place).toBeUndefined();
    }
    // A province's two letters are no country, and San Marino keeps Italy's clock.
    for (const place of ['NA-SAMPLETOWN (991)', 'SAMPLE S.G. TOWN (992)', 'SAN MARINO TEST (993)']) {
      expect(at(place), place).toMatchObject({ last_update: '2026-01-16T21:07:00+01:00', delivered_at: '2026-01-16T21:07:00+01:00' });
    }
  });

  it('dates scans at depots named after a country on Italy\'s clock, whichever of the two clocks BRT shows', () => {
    // Handed to a partner abroad: no arrival depot in Italy.
    const abroad = (place: string, date = '16.01.2026', clock = '21.07') => parseBrt(edit($ => {
      $('.table_dati_spedizione tr').last().remove();
      const first = $('.table_stato_dati tr').eq(1).children('td');
      first.eq(0).text(date); first.eq(1).text(clock); first.eq(2).text(place);
    }), NUMBER);
    for (const place of ['DPD-ROV-AUSTRIA (991)', 'DPD-ROV-GERMANIA (992)', 'BELGIO/LUSSEMBURGO (994)', 'FRANCIA SAMPLEVILLE (995)', 'GERMANY TEST (997)',
      'CHR-FR SAMPLE (998)', 'DPD AT TEST (999)']) {
      expect(abroad(place), place).toMatchObject({ status: 'delivered', last_update: '2026-01-16T21:07:00+01:00', delivered_at: '2026-01-16T21:07:00+01:00' });
      expect(abroad(place, '16.07.2026').last_update, place).toBe('2026-07-16T21:07:00+02:00');
      // The hour the change from summer time repeats stays local.
      expect(abroad(place, '25.10.2026', '02.30'), place).toMatchObject({ last_update: null, last_update_local: '2026-10-25T02:30:00' });
    }
    // A depot naming a country on another clock, or one of several zones, keeps its wall clock.
    for (const place of ['DPD IRLANDA (991)', 'AUSTRIA/REGNO UNITO (992)', 'DPD FRANCIA PORTOGALLO (993)', 'SAMPLE RUSSIA (994)']) {
      expect(abroad(place), place).toMatchObject({ last_update: null, last_update_local: '2026-01-16T21:07:00' });
    }
    // Two letters that are no single-zone country's code, or one on another clock: "GE" is Genoa's and Georgia's.
    for (const place of ['DPD-GE IMPORT TEST (995)', 'DPD-XX TEST (996)', 'CHR-FR XY (997)', 'SAMPLE US (998)', 'NA-SAMPLETOWN (999)']) {
      expect(abroad(place), place).toMatchObject({ last_update: null, last_update_local: '2026-01-16T21:07:00' });
    }
  });

  it('dates only the depot of origin of a shipment handed to a partner abroad', () => {
    // Without an arrival depot BRT delivers abroad, whatever its partner's depot is called.
    const result = parseBrt(edit($ => {
      $('.table_dati_spedizione tr').last().remove();
      $('.table_stato_dati tr').slice(1, 5).each((_, row) => { $(row).children('td').eq(2).text('SAMPLE PARTNER (990)'); });
      $('.table_stato_dati tr').slice(5).each((_, row) => { $(row).children('td').eq(2).text('TEST ORIGIN (991)'); });
    }), NUMBER);
    expect(result).toMatchObject({ status: 'delivered', last_update: null, last_update_local: '2026-01-16T21:07:00' });
    expect(result.delivered_at).toBeUndefined();
    expect(clocks(result.events)).toEqual(['local 2026-01-16T21:07:00', 'local 2026-01-14T15:49:00', '14.01.2026', 'local 2026-01-14T08:32:00',
      '2026-01-13T21:00:00+01:00', '2026-01-13T18:00:00+01:00', '2026-01-10T14:57:00+01:00']);
  });

  it('keeps a clock the change to or from summer time repeats or skips as a local time', () => {
    const at = (date: string, clock: string) => parseBrt(edit($ => {
      const first = $('.table_stato_dati tr').eq(1).children('td');
      first.eq(0).text(date); first.eq(1).text(clock);
    }), NUMBER);
    for (const [date, clock, local] of [['25.10.2026', '02.30', '2026-10-25T02:30:00'], ['29.03.2026', '02.30', '2026-03-29T02:30:00']] as const) {
      const result = at(date, clock);
      expect(result).toMatchObject({ status: 'delivered', last_update: null, last_update_local: local });
      expect(result.delivered_at).toBeUndefined();
    }
    expect(at('25.10.2026', '01.59').last_update).toBe('2026-10-25T01:59:00+02:00');
    expect(at('25.10.2026', '03.00').last_update).toBe('2026-10-25T03:00:00+01:00');
    expect(at('29.03.2026', '03.00').last_update).toBe('2026-03-29T03:00:00+02:00');
  });

  it('reports only the scoped matching TIS0868 parcel-label negative', () => {
    expect(() => parseBrt(negative(), NUMBER)).toThrowError(expect.objectContaining({ kind: 'not_found' }));
    for (const body of [negative(OTHER), negative().replace('TIS0868', 'TIS0000'), negative().replace('Errori riscontrati', 'Maintenance'),
      negative().replace('box_tool_content', 'hidden'), negative() + negative(), '<html>Parcel not found</html>',
      edit($ => $('.table_stato_dati').remove())]) {
      expect(() => parseBrt(body, NUMBER)).toThrow();
      expect(() => parseBrt(body, NUMBER)).not.toThrowError(expect.objectContaining({ kind: 'not_found' }));
    }
  });

  it('reads BRT\'s not-found-or-processing reply as an unknown shipment, never as absence', async () => {
    for (const number of [SHIPMENT, NUMBER, PARCEL_ID]) {
      expect(() => parseBrt(notFoundPage, number)).toThrowError(expect.objectContaining({ kind: 'indeterminate', reason: 'portal_not_found' }));
    }
    const fetcher = vi.fn<typeof fetch>(async () => new Response(Buffer.from(notFoundPage, 'latin1'),
      { headers: { 'Content-Type': 'text/html; charset=ISO-8859-1' } }));
    await expect(adapter(environment(fetcher)).track({ number: SHIPMENT, postcode: null }))
      .rejects.toMatchObject({ kind: 'indeterminate', reason: 'portal_not_found' });
    await expect(adapter(environment(fetcher)).recognize!(SHIPMENT)).rejects.toMatchObject({ kind: 'indeterminate', reason: 'portal_not_found' });
    const page = (fn: (document: ReturnType<typeof load>) => void) => { const $ = load(notFoundPage); fn($); return $.html(); };
    for (const body of [notFoundPage.replace('TIS0564', 'TIS0565'), notFoundPage.replace('TIS0564 ', ''), notFoundPage.replace('still being processed', 'being processed'),
      notFoundPage.replace('Errori riscontrati</label>', 'Avviso</label>'), notFoundPage.replace('box_tool_content', 'hidden'),
      page($ => $('#box_contenuti td').append(' Try again tomorrow')), page($ => $('#box_contenuti').clone().appendTo('#box_tool_content')),
      notFoundPage.replace('</body>', `${html}</body>`), notFoundPage + notFoundPage]) {
      expect(() => parseBrt(body, SHIPMENT)).not.toThrowError(expect.objectContaining({ reason: 'portal_not_found' }));
    }
  });

  it('does not promote older dated delivery when the newest clock or wording is unresolved', () => {
    for (const [date, clock] of [['', ''], ['31.02.2026', '25.00'], ['16.01.2026', '09.99'], ['Tomorrow', 'Any time']] as const) {
      const result = parseBrt(edit($ => {
        const first = $('.table_stato_dati tr').eq(1).children('td');
        first.eq(0).text(date); first.eq(1).text(clock); first.eq(3).text('NEW PROVIDER STATUS');
        $('.table_stato_dati tr').eq(2).children('td').last().text('DELIVERED');
      }), NUMBER);
      expect(result).toMatchObject({ status: 'unknown', last_status_text: 'NEW PROVIDER STATUS', last_update: null });
      expect(result.current_stage).toBeUndefined(); expect(result.last_update_local).toBeUndefined(); expect(result.delivered_at).toBeUndefined();
      expect(result.events?.[0]!.provider_time_text).toBe([date, clock].filter(Boolean).join(' ') || undefined);
      expect(result.events?.[0]!.local_time).toBeUndefined();
    }
    const delivered = parseBrt(edit($ => $('.table_stato_dati tr').eq(1).children('td').eq(1).text('')), NUMBER);
    expect(delivered.status).toBe('delivered'); expect(delivered.last_update_local).toBeUndefined(); expect(delivered.delivered_at).toBeUndefined();
  });

  it('keeps native newest-first position, equal clocks and repeated scans without inventing codes', () => {
    const body = edit($ => {
      const row = $('.table_stato_dati tr').eq(1);
      row.clone().insertAfter(row);
      $('.table_stato_dati tr').eq(2).children('td').last().text('FOR DELIVERY');
      row.clone().insertAfter($('.table_stato_dati tr').eq(2));
    });
    const result = parseBrt(body, NUMBER);
    expect(result.status).toBe('delivered');
    expect(result.events?.slice(0, 3).map(e => e.stage)).toEqual(['delivered', 'out_for_delivery', 'delivered']);
  });

  it('rejects incomplete or oversized scan tables and bounds retained history', () => {
    for (const body of [edit($ => $('.table_stato_dati tr').first().children('td').last().text('Different heading')),
      edit($ => $('.table_stato_dati tr').eq(1).children('td').last().remove()),
      edit($ => $('.table_stato_dati tr').eq(1).children('td').last().text('')),
      edit($ => $('.table_stato_dati').append('<tr><td>x</td></tr>'.repeat(502)))]) {
      expect(() => parseBrt(body, NUMBER)).toThrowError(expect.objectContaining({ kind: 'schema' }));
    }
    expect(() => parseBrt(edit($ => $('.table_stato_dati tr').slice(1).remove()), NUMBER)).toThrow(NoHistoryError);
    const many = edit($ => $('.table_stato_dati').append($('.table_stato_dati tr').eq(1).prop('outerHTML')!.repeat(120)));
    expect(parseBrt(many, NUMBER).events).toHaveLength(100);
  });

  it('retains only positive, unambiguous explicit kilogram weights', () => {
    for (const weight of ['0', '-1', 'NaN', '100001', '1 lb', '0,2 Peso (kg): 0,3']) {
      const result = parseBrt(edit($ => $('.table_dati_spedizione tr').eq(5).children('td').last().text(`PACCHI Peso (kg): ${weight}`)), NUMBER);
      expect(result.weight_kg).toBeUndefined();
    }
    expect(parseBrt(edit($ => $('.table_dati_spedizione tr').eq(5).children('td').last().text('PACCHI Peso (kg): 1.25 Volume m³: 0.5')), NUMBER).weight_kg).toBe(1.25);
  });

  it('retrieves the exact linked public event page in one bounded request without credentials or postcode', async () => {
    const fetcher = vi.fn<typeof fetch>(async (url, init) => {
      expect(String(url)).toBe(`https://vas.brt.it/vas/sped_det_new.htm?brtCode=${NUMBER}&lang=en`);
      expect(init).toMatchObject({ cache: 'no-store', redirect: 'manual' });
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      expect(new Headers(init?.headers).has('cookie')).toBe(false);
      expect(new Headers(init?.headers).has('authorization')).toBe(false);
      expect(init?.body).toBeUndefined();
      return response();
    });
    expect(await adapter(environment(fetcher)).track({ number: NUMBER, postcode: 'PRIVATE_SYNTHETIC_POSTCODE' })).toMatchObject({ status: 'delivered' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('recognizes matching history, ranked by its instants but not by local clocks, and propagates outages', async () => {
    const positive = vi.fn<typeof fetch>().mockResolvedValue(response());
    const instance = adapter(environment(positive));
    expect(await instance.recognize!('unsupported')).toEqual({ known: false }); expect(positive).not.toHaveBeenCalled();
    expect(await instance.recognize!(NUMBER)).toEqual({ known: true, lastActivityAt: '2026-01-16T20:07:00.000Z' });
    // Without an arrival depot in Italy, only the depot of origin is on Rome's clock.
    const abroad = vi.fn<typeof fetch>().mockResolvedValue(response(edit($ => $('.table_dati_spedizione tr').last().remove())));
    expect(await adapter(environment(abroad)).recognize!(NUMBER)).toEqual({ known: true, lastActivityAt: null });
    const absent = vi.fn<typeof fetch>().mockResolvedValue(response(negative()));
    expect(await adapter(environment(absent)).recognize!(NUMBER)).toEqual({ known: false });
    const outage = vi.fn<typeof fetch>().mockResolvedValue(response('<html>Unavailable</html>'));
    await expect(adapter(environment(outage)).recognize!(NUMBER)).rejects.toMatchObject({ kind: 'indeterminate' });
  });

  it('decodes the legacy page encoding while rejecting unknown encodings', async () => {
    const body = html.replaceAll('TEST DEPOT', 'TEST DÉPÔT');
    const latin = vi.fn<typeof fetch>().mockResolvedValue(new Response(Buffer.from(body, 'latin1')));
    expect((await new BrtTracker({ fetcher: latin }).fetch(NUMBER)).events?.[0]!.location).toBe('TEST DÉPÔT (990)');
    const changed = vi.fn<typeof fetch>().mockResolvedValue(new Response(body, { headers: { 'Content-Type': 'text/html;charset=UTF-16' } }));
    await expect(new BrtTracker({ fetcher: changed }).fetch(NUMBER)).rejects.toMatchObject({ kind: 'schema' });
  });

  it('classifies HTTP failures without treating generic 404/410 or redirects as parcel absence', async () => {
    for (const [status, kind] of [[302, 'indeterminate'], [404, 'indeterminate'], [410, 'indeterminate'], [403, 'challenge'], [429, 'rate_limited'], [503, 'maintenance']] as const) {
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(negative(), { status }));
      await expect(new BrtTracker({ fetcher }).fetch(NUMBER)).rejects.toMatchObject({ kind });
      expect(fetcher).toHaveBeenCalledTimes(1);
    }
    const oversized = vi.fn<typeof fetch>().mockResolvedValue(new Response(new Uint8Array(1_000_001)));
    await expect(new BrtTracker({ fetcher: oversized }).fetch(NUMBER)).rejects.toThrow('unexpectedly large');
    expect(oversized).toHaveBeenCalledTimes(1);
  });

  it('preserves caller cancellation and rejects responses arriving after a fractional lookup budget', async () => {
    const immediate = vi.fn<typeof fetch>().mockResolvedValue(response());
    await expect(new BrtTracker({ fetcher: immediate }).fetch(NUMBER, { signal: AbortSignal.abort() })).rejects.toBeInstanceOf(Error);
    await expect(new BrtTracker({ fetcher: immediate }).fetch(NUMBER, { budgetMs: 0 })).rejects.toMatchObject({ kind: 'budget' });
    expect(immediate).not.toHaveBeenCalled();
    const controller = new AbortController();
    const waiting = vi.fn<typeof fetch>(async (_url, init) => {
      await new Promise((_resolve, reject) => { init?.signal?.throwIfAborted(); init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true }); });
      return response();
    });
    const active = new BrtTracker({ fetcher: waiting }).fetch(NUMBER, { signal: controller.signal }); controller.abort();
    await expect(active).rejects.toMatchObject({ kind: 'transport' }); expect(waiting).toHaveBeenCalledTimes(1);
    const late = vi.fn<typeof fetch>(async () => { await new Promise(resolve => setTimeout(resolve, 35)); return response(); });
    await expect(new BrtTracker({ fetcher: late }).fetch(NUMBER, { budgetMs: 20.5 })).rejects.toMatchObject({ kind: 'budget' });
    expect(late).toHaveBeenCalledTimes(1);
  });
});

describe('BRT origin legs', () => {
  const scan = (description: string, clock: string, stage?: string): CarrierEvent => ({ description, ...(stage ? { stage } : {}),
    ...(clock.length > 19 ? { time: clock } : { local_time: clock }) });
  const brt = (events: CarrierEvent[], status: CarrierResult['status'] = 'in_transit'): CarrierResult => ({ status,
    current_stage: events[0]!.stage, last_status_text: events[0]!.description, last_update: events[0]!.time ?? null,
    ...(events[0]!.local_time ? { last_update_local: events[0]!.local_time } : {}), events });
  const partner = (...events: CarrierEvent[]): CarrierResult => ({ status: 'in_transit', current_stage: 'in_transit',
    last_status_text: events[0]!.description, last_update: events[0]!.time ?? null, history_truncated: true, events });
  const descriptions = (result: CarrierResult) => result.events!.map(event => event.description);
  const preAdvice = (clock: string) => scan('SHIPPING INFO SENT TO BRT', clock, 'registered');

  it('names the partner of a shipment whose oldest scan is at its import depot', () => {
    const from = (location: string) => brtOriginPartner({ events: [{ location: 'TEST DEPOT (990)' }, { location }] });
    expect(from('CHR-FR SAMPLE (998)')).toBe('chronopost');
    expect(from('DPD SAMPLE (990)')).toBe('dpd');
    expect(from('DPD-ROV-SAMPLE (991)')).toBe('dpd');
    for (const location of ['TEST DEPOT (990)', 'DPDSAMPLE (990)', 'SAMPLE DPD (990)', '']) expect(from(location), location).toBeNull();
    expect(brtOriginPartner({ events: [{ location: 'DPD SAMPLE (990)' }, { location: 'TEST DEPOT (990)' }] })).toBeNull();
  });

  it('puts the partner\'s scans before BRT\'s first scan beyond its shipping data under BRT\'s, in time order', () => {
    const result = withOriginLeg(brt([scan('DEPARTED', '2026-01-13T21:00:00+01:00', 'in_transit'), scan('COLLECTED', '2026-01-13T18:00:00+01:00', 'accepted'),
      preAdvice('2026-01-12T18:02:00+01:00')]), partner(scan('Sample notice', '2026-01-14T19:00:00+01:00'), scan('Sample transit', '2026-01-13T15:58:00+01:00'),
      scan('Sample sort', '2026-01-12T18:11:00+01:00'), scan('Sample preparation', '2026-01-12T07:45:00+01:00')));
    expect(descriptions(result)).toEqual(['DEPARTED', 'COLLECTED', 'Sample transit', 'Sample sort', 'SHIPPING INFO SENT TO BRT', 'Sample preparation']);
    expect(result).toMatchObject({ status: 'in_transit', current_stage: 'in_transit', last_status_text: 'DEPARTED', last_update: '2026-01-13T21:00:00+01:00' });
    expect(result.history_truncated).toBeUndefined();
  });

  it('takes the partner\'s status while BRT has only the shipping data and the partner has scanned the parcel since', () => {
    const result = withOriginLeg(brt([preAdvice('2026-01-12T10:10:00')], 'pending'),
      partner(scan('Sample on its way', '2026-01-17T00:53:00+01:00'), scan('Sample handed over', '2026-01-12T15:50:00Z')));
    // BRT's wall clock cannot be placed among the partner's instants and stays last.
    expect(descriptions(result)).toEqual(['Sample on its way', 'Sample handed over', 'SHIPPING INFO SENT TO BRT']);
    expect(result).toMatchObject({ status: 'in_transit', current_stage: 'in_transit', last_status_text: 'Sample on its way', last_update: '2026-01-17T00:53:00+01:00' });
    expect(result.last_update_local).toBeUndefined();
    expect(result.history_truncated).toBeUndefined();
    // Shipping data sent after the partner's last scan keeps BRT's status.
    const sent = withOriginLeg(brt([preAdvice('2026-01-12T18:02:00+01:00')], 'pending'), partner(scan('Sample preparation', '2026-01-12T07:45:00+01:00')));
    expect(descriptions(sent)).toEqual(['SHIPPING INFO SENT TO BRT', 'Sample preparation']);
    expect(sent).toMatchObject({ status: 'pending', current_stage: 'registered', last_update: '2026-01-12T18:02:00+01:00' });
  });

  it('keeps only partner scans surely before a wall clock, and leaves a shipment without a dated leg as it was', () => {
    const local = brt([scan('COLLECTED', '2026-01-13T18:00:00', 'accepted'), preAdvice('2026-01-12T10:00:00')]);
    const result = withOriginLeg(local, partner(scan('Sample late', '2026-01-13T04:30:00Z'), scan('Sample early', '2026-01-13T03:30:00Z')));
    expect(descriptions(result)).toEqual(['COLLECTED', 'Sample early', 'SHIPPING INFO SENT TO BRT']);
    expect(withOriginLeg(local, partner(scan('Sample late', '2026-01-13T04:30:00Z')))).toBe(local);
    expect(withOriginLeg(local, partner(scan('Sample undated', '2026-01-10T08:00:00')))).toBe(local);
    expect(withOriginLeg(local, { status: 'in_transit', events: [] })).toBe(local);
  });

  it('asks the partner named by the oldest depot about the same BRTcode within the lookup budget', async () => {
    const page = (location: string) => edit($ => $('.table_stato_dati tr').last().children('td').eq(2).text(location));
    const dpd = vi.fn<BrtOriginLookup>(async () => partner(scan('Sample handed over', '2026-01-10T08:00:00Z')));
    const chronopost = vi.fn<BrtOriginLookup>();
    const tracker = (body: string) => new BrtTracker({ fetcher: vi.fn<typeof fetch>().mockResolvedValue(response(body)), origins: { dpd, chronopost } });
    const result = await tracker(page('DPD SAMPLE (990)')).fetch(NUMBER, { budgetMs: 10_000 });
    expect(dpd).toHaveBeenCalledTimes(1);
    expect(dpd.mock.calls[0]![0]).toBe(NUMBER);
    expect(dpd.mock.calls[0]![1].signal).toBeInstanceOf(AbortSignal);
    expect(dpd.mock.calls[0]![1].budgetMs).toBeLessThan(10_000);
    expect(chronopost).not.toHaveBeenCalled();
    expect(result).toMatchObject({ status: 'delivered', last_update: '2026-01-16T21:07:00+01:00' });
    expect(result.events!.map(event => event.description).slice(-3)).toEqual(['COLLECTED', 'Sample handed over', 'SHIPPING INFO SENT TO BRT']);
    // A shipment that started at one of BRT's depots, or a parcel the partner cannot answer for, keeps BRT's answer.
    expect(await tracker(html).fetch(NUMBER)).toEqual(parseBrt(html, NUMBER));
    expect(dpd).toHaveBeenCalledTimes(1);
    dpd.mockRejectedValueOnce(new IndeterminateError('DPD', 'Sample outage'));
    expect(await tracker(page('DPD SAMPLE (990)')).fetch(NUMBER)).toEqual(parseBrt(page('DPD SAMPLE (990)'), NUMBER));
    // The caller's cancellation still ends the lookup.
    const controller = new AbortController();
    dpd.mockImplementationOnce(async () => { controller.abort(); throw new Error('aborted'); });
    await expect(tracker(page('DPD SAMPLE (990)')).fetch(NUMBER, { signal: controller.signal })).rejects.toBeInstanceOf(Error);
  });

  it('wires Chronopost to its own endpoint for tracking, and recognizes from BRT alone', async () => {
    const body = edit($ => $('.table_stato_dati tr').last().children('td').eq(2).text('CHR-FR SAMPLE (998)'));
    const fetcher = vi.fn<typeof fetch>(async (url) => String(url).startsWith('https://vas.brt.it/') ? response(body) : new Response('', { status: 404 }));
    const instance = adapter(environment(fetcher));
    expect(await instance.recognize!(NUMBER)).toMatchObject({ known: true });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(await instance.track({ number: NUMBER, postcode: null })).toEqual(parseBrt(body, NUMBER));
    expect(fetcher).toHaveBeenCalledTimes(3);
    const [url, init] = fetcher.mock.calls[2]!;
    expect(String(url)).toBe('https://ws.chronopost.fr/tracking-cxf/TrackingServiceWS');
    expect(String(init?.body)).toContain(`<skybillNumber>${NUMBER}</skybillNumber>`);
  });
});
