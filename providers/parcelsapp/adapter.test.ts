// @vitest-environment node
import { readFileSync } from 'node:fs';
import timers from 'node:timers/promises';
import { DateTime } from 'luxon';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TrawlClient } from '../../core/transport/index.js';
import { carrierErrorKind, IndeterminateError, InputRequiredError, NoHistoryError } from '../../core/errors/index.js';
import type { LookupRecord, StepRecord, StepRecorder } from '../../core/telemetry/index.js';
import { ParcelsAppTracker, parseParcelsAppHtml, parseParcelsAppResponse } from './adapter.js';

const number = 'ZZ12345678900';
const API = 'https://parcelsapp.com/api/v2/parcels';
const announced = JSON.parse(readFileSync(new URL('./fixtures/announced.json', import.meta.url), 'utf8')) as { states: unknown[] };
const undatedLeg = JSON.parse(readFileSync(new URL('./fixtures/undated-leg.json', import.meta.url), 'utf8')) as { carriers: string[]; states: Record<string, unknown>[] };

/** The result table the page renders; the API reply itself carries no number. */
const identity = (value = number) => `<div class="tracking-info"><div class="parcel"><table class="parcel-attributes"><tr><td>Tracking number</td><td>${value}</td></tr></table></div></div>`;
const rendered = (rows: string) => identity().replace('</table>', `</table><ul class="events">${rows}</ul>`);
const row = (date: string, time: string, description: string) =>
  `<li class="event"><div class="event-time"><strong>${date}</strong><span>${time}</span></div><div class="event-content"><strong>${description}</strong></div></li>`;
const carrierRow = (date: string, time: string, description: string, carrier: string) =>
  `<li class="event"><div class="event-time"><strong>${date}</strong><span>${time}</span></div><div class="event-content"><strong>${description}</strong><div class="carrier"><div class="courier-icon"></div> ${carrier} </div></div></li>`;

it('keeps scan locations from the API while excluding a delivery-service label and Posti\'s "abroad"', () => {
  const parse = (location: unknown) => parseParcelsAppResponse({
    carriers: ['Chronopost'], states: [{ date: '2026-07-12T10:15:00Z', status: 'In transit', carrier: 0, location }],
  }, number, identity()).events?.[0];
  expect(parse('  Example   Sorting Centre, France  ')?.location).toBe('Example Sorting Centre, France');
  expect(parse('France')?.location).toBe('France');
  for (const location of [undefined, '', 'Type de livraison : Livraison Standard', 'ULKOMAILLA', ['France'], { city: 'Example City' }]) {
    expect(parse(location)).not.toHaveProperty('location');
  }
});

it('keeps the reported place when another carrier repeats a delivery without a location', () => {
  const result = parseParcelsAppResponse({ carriers: ['Chronopost', 'DHL'], states: [
    { date: '2026-07-12T10:15:00Z', status: 'Livraison effectuée', carrier: 0, location: 'Example Sorting Centre, France' },
    { date: '2026-07-12T10:15:00Z', status: 'Delivered', carrier: 1 },
  ] }, number, identity(), 'Europe/Paris');
  expect(result.events).toHaveLength(1);
  expect(result.events?.[0]).toMatchObject({ description: 'Delivered', location: 'Example Sorting Centre, France' });
});

const captured = (data: unknown, overrides: Record<string, unknown> = {}) => new Response(JSON.stringify({
  url: `https://parcelsapp.com/en/tracking/${number}`, html: identity(), statusCode: 200, tier: 3,
  capturedResponses: [{ url: API, body: JSON.stringify(data), status: 200, truncated: false, base64Encoded: false }],
  ...overrides,
}));

function tracker(fetcher: typeof fetch, trawlUrl = 'http://browser.test') {
  return new ParcelsAppTracker({ httpClient: null, trawl: new TrawlClient(trawlUrl, fetcher) });
}

describe('ParcelsApp YTO scans', () => {
  // YTO's scan types as ParcelsApp relays them, in Chinese or in its own translation.
  const labels = {
    chinese: ['揽收扫描', '装件入车扫描', '下车扫描', '派件扫描', '入柜|入库', 'PDA正常签收扫描', '退回件扫描'],
    english: ['Pickup scan', 'Load scan into vehicle', 'Get off scan', 'Delivery scan', 'In cabinet | In storage', 'PDA normal delivery scan', 'Return package scan'],
  };
  // ParcelsApp labels the scans' China wall clock as UTC.
  const states = (names: string[], order: number[]) => order.map((index, position) => ({
    date: `2026-05-0${position + 1}T18:00:00Z`, status: names[index], carrier: 0,
  })).reverse();
  const history = (language: keyof typeof labels, order: number[]) =>
    parseParcelsAppResponse({ carriers: ['YTO Express'], states: states(labels[language], order) }, number, identity());

  it('gives both label languages the same stages and stored wording', () => {
    const chinese = history('chinese', [0, 1, 2, 3, 4, 5]);
    expect(history('english', [0, 1, 2, 3, 4, 5]).events).toEqual(chinese.events);
    expect(chinese.events?.every((event) => event.stage_source === 'carrier_map')).toBe(true);
    expect(chinese).toMatchObject({ status: 'delivered', current_stage: 'delivered' });
    expect(chinese.events?.map((event) => [event.time, event.description, event.stage])).toEqual([
      ['2026-05-06T10:00:00.000Z', 'Delivered', 'delivered'],
      ['2026-05-05T10:00:00.000Z', 'In a parcel locker or pickup station', 'ready_for_pickup'],
      ['2026-05-04T10:00:00.000Z', 'Out for delivery', 'out_for_delivery'],
      ['2026-05-03T10:00:00.000Z', 'Unloaded at a sorting centre', 'in_transit'],
      ['2026-05-02T10:00:00.000Z', 'Loaded for transport', 'in_transit'],
      ['2026-05-01T10:00:00.000Z', 'Picked up', 'accepted'],
    ]);
  });

  it.each(['chinese', 'english'] as const)('reads the delivery-side scans after a return scan as the trip back (%s)', (language) => {
    const returned = history(language, [0, 1, 6, 3, 4, 5]);
    expect(returned).toMatchObject({ status: 'exception', current_stage: 'returned', last_status_text: 'Returned to the sender' });
    expect(returned.events?.slice(0, 4).map((event) => [event.description, event.stage])).toEqual([
      ['Returned to the sender', 'returned'],
      ['In a parcel locker or station on its way back', 'ready_for_pickup'],
      ['Out for delivery back to the sender', 'out_for_delivery'],
      ['Return to the sender started', 'exception'],
    ]);
  });

  it.each(['chinese', 'english'] as const)('keeps return transit open before sender delivery (%s)', language => {
    expect(history(language, [0, 1, 6])).toMatchObject({ status: 'exception', current_stage: 'exception' });
    expect(history(language, [0, 1, 6, 3])).toMatchObject({ status: 'out_for_delivery', current_stage: 'out_for_delivery' });
    expect(history(language, [0, 1, 6, 3, 4])).toMatchObject({ status: 'out_for_delivery', current_stage: 'ready_for_pickup' });
    expect(history(language, [0, 1, 6, 3, 4]).events?.[0]).toMatchObject({ provider_leg: 'return' });
  });

  it('leaves labels of other carriers and unknown YTO labels to the shared rules', () => {
    const other = parseParcelsAppResponse({ carriers: ['Example Parcel Co'], states: [{ date: '2026-05-01T18:00:00Z', status: '派件扫描', carrier: 0 }] }, number, identity());
    expect(other.events?.[0]).toMatchObject({ description: '派件扫描', stage: 'pending', stage_source: 'none' });
    const unknown = parseParcelsAppResponse({ carriers: ['YTO Express'], states: [{ date: '2026-05-01T18:00:00Z', status: '问题件扫描', carrier: 0 }] }, number, identity());
    expect(unknown.events?.[0]).toMatchObject({ description: '问题件扫描', stage: 'pending', stage_source: 'none' });
  });

  it('reads the same scans from the rendered page', () => {
    const scan = (day: string, description: string) =>
      `<li class="event"><div class="event-time"><strong>0${day} May 2026</strong><span>18:00</span></div><div class="event-content"><strong>${description}</strong><span class="carrier">YTO Express</span></div></li>`;
    const page = rendered([scan('2', 'PDA正常签收扫描'), scan('1', '揽收扫描')].join(''));
    expect(parseParcelsAppHtml(page, number).events?.map((event) => [event.time, event.description, event.stage])).toEqual([
      ['2026-05-02T10:00:00.000Z', 'Delivered', 'delivered'],
      ['2026-05-01T10:00:00.000Z', 'Picked up', 'accepted'],
    ]);
  });
});

describe('ParcelsApp result parsing', () => {
  it('does not treat postal-code prompts or delivery preferences as movement', () => {
    const result = parseParcelsAppResponse(announced, number, identity());
    expect(result).toMatchObject({ status: 'pending', current_stage: 'registered', tracking_provider: 'ParcelsApp' });
    expect(result.events).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain('PRIVATE');
    expect(() => parseParcelsAppResponse({ states: [{ date: '2026-08-18T00:00:00Z', status: 'Enter the recipient postal code', require_fields: [{}] }] }, number, identity())).toThrow();
  });

  it.each(['json', 'html'])('classifies French preparation and a Mondial Relay hub scan separately (%s)', (transport) => {
    // Synthetic identifier, dates and depot; preserve only the wording that caused the bug.
    const states = [
      { date: '2026-01-05T08:30:00Z', status: 'Prise en charge de votre colis sur notre site logistique de VILLE-EXEMPLE.' },
      { date: '2026-01-04T09:15:00Z', status: "Colis en préparation chez l'expéditeur" },
    ];
    const parsed = transport === 'json' ? parseParcelsAppResponse({ states }, number, identity())
      : parseParcelsAppHtml(rendered(row('05 Jan 2026', '08:30', states[0]!.status) + row('04 Jan 2026', '09:15', states[1]!.status)), number);
    // Every logistics site logs its own "prise en charge": movement, not acceptance.
    expect(parsed).toMatchObject({ status: 'in_transit', current_stage: 'in_transit',
      last_update: '2026-01-05T08:30:00.000Z', tracking_provider: 'ParcelsApp' });
    expect(parsed.events?.map(({ stage }) => stage)).toEqual(['in_transit', 'registered']);
    const preparationOnly = parseParcelsAppResponse({ states: [states[1]] }, number, identity());
    expect(preparationOnly).toMatchObject({ status: 'pending', current_stage: 'registered' });
  });

  it.each(['json', 'html'])('reads the TIPSA labels it relays twice over (%s)', (transport) => {
    // TIPSA's wording, written twice as ParcelsApp relays it; synthetic dates and agency.
    const scans = [
      ['08', '18:50', 'ENTREGADO'],
      ['07', '08:30', 'REPARTO'],
      ['06', '15:00', 'Ausente'],
      ['06', '08:30', 'REPARTO'],
      ['05', '17:20', 'LECTURA EN AGENCIA DESTINO EJEMPLO 01'],
      ['05', '17:10', 'LEIDO EN DESTINO'],
      ['02', '22:20', 'TRANSITO'],
      ['02', '17:50', 'PENDIENTE DE ENTREGAR A TIPSA'],
    ] as const;
    const parsed = transport === 'json'
      ? parseParcelsAppResponse({ carriers: ['TIPSA'], states: scans.map(([day, time, label]) => ({
        date: `2026-05-${day}T${time}:00Z`, status: label + label, carrier: 0,
      })) }, number, identity())
      : parseParcelsAppHtml(rendered(scans.map(([day, time, label]) => carrierRow(`${day} May 2026`, time, label + label, 'TIPSA')).join('')), number);
    expect(parsed).toMatchObject({ status: 'delivered', current_stage: 'delivered', last_status_text: 'Delivered' });
    // TIPSA's history is on Madrid time, Portuguese agencies included.
    expect(parsed.events?.map(({ time, description, stage }) => [time, description, stage])).toEqual([
      ['2026-05-08T16:50:00.000Z', 'Delivered', 'delivered'],
      ['2026-05-07T06:30:00.000Z', 'REPARTO', 'out_for_delivery'],
      ['2026-05-06T13:00:00.000Z', 'Ausente', 'failed_attempt'],
      ['2026-05-06T06:30:00.000Z', 'REPARTO', 'out_for_delivery'],
      ['2026-05-05T15:20:00.000Z', 'LECTURA EN AGENCIA DESTINO EJEMPLO 01', 'in_transit'],
      ['2026-05-05T15:10:00.000Z', 'LEIDO EN DESTINO', 'in_transit'],
      ['2026-05-02T20:20:00.000Z', 'TRANSITO', 'in_transit'],
      ['2026-05-02T15:50:00.000Z', 'PENDIENTE DE ENTREGAR A TIPSA', 'registered'],
    ]);
  });

  it('collapses only a label made of two identical halves', () => {
    const parsed = parseParcelsAppResponse({ states: [
      { date: '2026-05-02T10:00:00Z', status: 'ENTREGADOENTREGADA' },
      { date: '2026-05-01T10:00:00Z', status: 'REPARTO REPARTO' },
    ] }, number, identity());
    expect(parsed.events?.map(({ description }) => description)).toEqual(['ENTREGADOENTREGADA', 'REPARTO REPARTO']);
  });

  it('binds a numberless response to its rendered result', () => {
    for (const html of [identity('OTHER123'), `<input value="${number}">`, identity() + identity()]) {
      expect(() => parseParcelsAppResponse(announced, number, html)).toThrow('identity missing');
    }
  });

  it('rejects malformed timestamps and error-only responses', () => {
    // Unlike a missing date, a malformed one fails the reply, even beside dated scans.
    for (const date of ['today', '2026-02-31T03:04:00', '2026-02-31T03:04:00Z']) {
      const states = [{ date, status: 'Delivered' }, { date: '2026-08-17T03:04:00Z', status: 'In transit' }];
      expect(() => parseParcelsAppResponse({ states }, number, identity())).toThrow();
    }
    expect(() => parseParcelsAppResponse({ error: 'NO_TRACKER', states: [] }, number, identity())).toThrow();
  });

  it('counts a state without a date instead of failing the reply or reading it as the latest scan', () => {
    // Live shape (2026-09-29): an Asendia Spain leg with no date after dated US scans.
    const undated = undatedLeg.states.find((state) => !('date' in state))!;
    const dated = undatedLeg.states.filter((state) => state !== undated);
    for (const states of [undatedLeg.states, [{ ...undated, date: null, status: 'Delivered' }, ...dated]]) {
      const parsed = parseParcelsAppResponse({ ...undatedLeg, states }, number, identity());
      expect(parsed).toMatchObject({ status: 'in_transit', current_stage: 'in_transit', last_status_text: 'Dispatched by Asendia',
        last_update: '2026-03-10T18:10:00.000Z', undated_event_count: 1 });
      expect(parsed.events?.map((scan) => scan.time)).toEqual(dated.map((state) => DateTime.fromISO(String(state.date)).toUTC().toISO()));
    }
    expect(() => parseParcelsAppResponse({ ...undatedLeg, states: [undated] }, number, identity())).toThrow('No usable tracking events');
  });

  it('counts an offset-less date that no zone resolves, and places one that a zone resolves', () => {
    const states = [
      { date: '2026-03-11T09:00:00', status: 'Out for delivery' },
      { date: '2026-03-10T18:10:00Z', status: 'Departed from the sorting centre' },
    ];
    // A later wall time with no zone is no instant, so it cannot become the newest scan.
    expect(parseParcelsAppResponse({ states }, number, identity())).toMatchObject({ current_stage: 'in_transit',
      last_update: '2026-03-10T18:10:00.000Z', undated_event_count: 1, events: [{ description: 'Departed from the sorting centre' }] });
    const placed = parseParcelsAppResponse({ states }, number, identity(), 'Europe/Zurich');
    expect(placed).toMatchObject({ current_stage: 'out_for_delivery', last_update: '2026-03-11T08:00:00.000Z' });
    expect(placed.undated_event_count).toBeUndefined();
  });

  it('reads the undated state the page prints as "aN Inv NaN" as the JSON reply does', () => {
    // The page formats a missing date through Date.parse, so every field is NaN.
    const page = rendered(undatedLeg.states.map((state) => {
      const date = typeof state.date === 'string' ? DateTime.fromISO(state.date, { zone: 'UTC', locale: 'en' }) : null;
      return carrierRow(date?.toFormat('dd LLL yyyy') ?? 'aN Inv NaN', date?.toFormat('HH:mm') ?? 'aN:aN',
        String(state.status), undatedLeg.carriers[Number(state.carrier)]!);
    }).join(''));
    const html = parseParcelsAppHtml(page, number);
    const json = parseParcelsAppResponse(undatedLeg, number, identity());
    expect(html).toMatchObject({ undated_event_count: 1, last_update: json.last_update, current_stage: json.current_stage });
    // This page fixture has no location fields; its scan clocks and wording still agree.
    expect(html.events).toEqual(json.events?.map((event) => {
      const scan = { ...event };
      delete scan.location;
      return scan;
    }));
    expect(new Set(html.reported_carriers as string[])).toEqual(new Set(json.reported_carriers as string[]));
    expect(() => parseParcelsAppHtml(rendered(carrierRow('aN Inv NaN', 'aN:aN', 'Departed from Asendia', 'Asendia Spain')), number))
      .toThrow('No usable tracking events');
  });

  it('keeps unknown historical wording pending rather than inheriting delivered', () => {
    const result = parseParcelsAppResponse({ states: [
      { date: '2026-08-18T03:04:00Z', status: 'Delivered by mailbox, PIN: PRIVATE' },
      { date: '2026-08-17T03:04:00Z', status: 'Additional information provided' },
    ] }, number, identity());
    expect(result.current_stage).toBe('delivered');
    expect(result.events?.[1]!.stage).toBe('pending');
    expect(JSON.stringify(result)).not.toContain('PRIVATE');
  });

  it('keeps a Quickpac pre-advice from reporting the parcel as delivered', () => {
    // Observed wording (2026-09-21); synthetic number and dates.
    const result = parseParcelsAppResponse({
      carriers: ['Planzer', 'Quickpac'],
      states: [{ date: '2026-06-10T12:22:20Z', carrier: 1, status: 'Shipment recorded by sender (data delivered)' }],
    }, number, identity(), 'Europe/Zurich');
    expect(result).toMatchObject({ status: 'pending', current_stage: 'registered' });
    expect(result.events?.[0]).toMatchObject({ stage: 'registered', description: 'Shipment recorded by sender (data delivered)' });
  });

  it('re-reads each scan in its carrier\'s or location\'s zone instead of the UTC ParcelsApp labels', () => {
    // Live shapes (2026-09-22): the carrier's local clock as "+00:00" or shifted into "+02:00".
    const result = parseParcelsAppResponse({
      carriers: ['India Post', 'Universal Postal Union', 'Swiss Post'],
      states: [
        { date: '2026-06-12T13:30:00+02:00', status: 'Delivered', carrier: 2 },
        { date: '2026-06-11T18:10:00+02:00', status: 'Shipment was sorted', carrier: 1, location: 'Example Parcel Centre, Switzerland' },
        { date: '2026-06-08T15:20:00Z', status: 'Arrived at international sorting center', carrier: 1, location: 'EXAMPLE AIR HUB' },
        { date: '2026-06-05T20:30:00Z', status: 'Item booked', carrier: 0 },
      ],
    }, number, identity());
    expect(result.events?.map((scan) => scan.time)).toEqual([
      '2026-06-12T09:30:00.000Z', // Swiss Post: 11:30 in Zurich
      '2026-06-11T14:10:00.000Z', // unmapped carrier, located in Switzerland
      '2026-06-08T15:20:00.000Z', // no zone to resolve: kept as labeled
      '2026-06-05T15:00:00.000Z', // India Post: 20:30 in Kolkata
    ]);
  });

  it('falls back to the parcel carrier\'s zone when a scan names no usable carrier or place', () => {
    const payload = { carriers: ['Example Parcel Co'], states: [{ date: '2026-06-10T14:05:00+00:00', status: 'Return to sender', carrier: 0 }] };
    expect(parseParcelsAppResponse(payload, number, identity(), 'Europe/Zurich').events?.[0]?.time).toBe('2026-06-10T12:05:00.000Z');
    expect(parseParcelsAppResponse(payload, number, identity()).events?.[0]?.time).toBe('2026-06-10T14:05:00.000Z');
    expect(parseParcelsAppHtml(rendered(row('10 Jun 2026', '14:05', 'Return to sender')), number, 'Europe/Zurich').events?.[0]?.time)
      .toBe('2026-06-10T12:05:00.000Z');
  });

  it('keeps a scan located in another country as labeled instead of reading it in the parcel carrier\'s zone', () => {
    // Live shape (2026-09-29): Asendia USA scans on a number filed under Swiss
    // Post, labeled with the UTC instants of Asendia's own feed.
    const times = (payload: Record<string, unknown>) =>
      parseParcelsAppResponse(payload, number, identity(), 'Europe/Zurich').events?.map((scan) => scan.time);
    expect(times(undatedLeg)).toEqual([
      '2026-03-10T18:10:00.000Z', '2026-03-10T15:40:00.000Z', '2026-03-10T06:15:00.000Z',
      '2026-03-10T00:00:00.000Z', // WNDirect, with no location, on Zurich time
      '2026-03-09T21:30:00.000Z',
    ]);
    const scan = (location: string, carriers = ['Example Parcel Co']) => times({
      carriers, states: [{ date: '2026-07-02T18:30:00+00:00', status: 'In transit', carrier: 0, location }],
    })?.[0];
    // A country with several clocks, by name or code, or one with no listed zone.
    for (const location of ['EXAMPLE CITY, CA, United States', 'EXAMPLE CITY, CA, US', 'EXAMPLE CITY, South Africa']) {
      expect(scan(location)).toBe('2026-07-02T18:30:00.000Z');
    }
    // The parcel carrier's country, or a place with no country it can tell.
    for (const location of ['Example Hub, Switzerland', 'Example Hub', 'Example City, ON']) {
      expect(scan(location)).toBe('2026-07-02T16:30:00.000Z');
    }
    // The country a carrier name ends with is a guess too: it can be a branch.
    expect(scan('EXAMPLE CITY, United States', ['Cainiao (China)'])).toBe('2026-07-02T18:30:00.000Z');
    expect(times({ states: [{ date: '2026-07-02T18:30:00+00:00', status: 'In transit', location: 'EXAMPLE CITY, South Africa' }] }))
      .toEqual(['2026-07-02T18:30:00.000Z']);
  });

  it.each([
    ['DPD UK', '2026-07-02T17:30:00.000Z'],
    ['DPD Germany', '2026-07-02T16:30:00.000Z'],
    ['Hermes UK', '2026-07-02T17:30:00.000Z'],
  ])('lets a scan location refine the country-qualified name %s', (name, local) => {
    const scan = (location?: string) => parseParcelsAppResponse({
      carriers: [name], states: [{ date: '2026-07-02T18:30:00+00:00', status: 'In transit', carrier: 0, ...(location ? { location } : {}) }],
    }, number, identity()).events?.[0]?.time;
    expect(scan()).toBe(local);
    expect(scan('Example Hub, Spain')).toBe('2026-07-02T16:30:00.000Z');
    expect(scan('Example Hub, United States')).toBe('2026-07-02T18:30:00.000Z');
  });

  it('uses a bare brand clock only when all catalog networks agree', () => {
    // DPD's catalog includes the UK, so a bare group name has no single clock.
    const scans = (carriers: string[], dates: string[], extra: Record<string, unknown> = {}) => parseParcelsAppResponse({
      carriers, states: dates.map((date) => ({ date, status: 'In transit', carrier: 0, ...extra })),
    }, number, identity()).events?.map((scan) => scan.time);
    expect(scans(['DPD Group'], ['2026-07-02T18:30:00+00:00', '2026-01-14T09:15:00+00:00'])).toEqual([
      '2026-07-02T18:30:00.000Z',
      '2026-01-14T09:15:00.000Z',
    ]);
    expect(scans(['GLS'], ['2026-07-02T18:30:00+00:00'])).toEqual(['2026-07-02T16:30:00.000Z']);
    expect(scans(['Hermes'], ['2026-01-14T09:15:00+00:00'])).toEqual(['2026-01-14T08:15:00.000Z']);
    // A network the name or location places elsewhere keeps that country's clock.
    expect(scans(['DPD UK'], ['2026-07-02T18:30:00+00:00'])).toEqual(['2026-07-02T17:30:00.000Z']);
    expect(scans(['DPD Group'], ['2026-07-02T18:30:00+00:00'], { location: 'Example Hub, United Kingdom' }))
      .toEqual(['2026-07-02T17:30:00.000Z']);
    // A location it cannot place may be a network outside the catalog: no brand clock.
    for (const location of ['EXAMPLE CITY, CA, US', 'Example City, ON', 'Example Hub']) {
      expect(scans(['GLS'], ['2026-07-02T18:30:00+00:00'], { location })).toEqual(['2026-07-02T18:30:00.000Z']);
    }
    // A name's country can be a branch: the scan's own location comes first.
    expect(scans(['Cainiao (China)'], ['2026-07-02T18:30:00+00:00'], { location: 'Example Hub, Spain' }))
      .toEqual(['2026-07-02T16:30:00.000Z']);
    expect(scans(['Cainiao (China)'], ['2026-07-02T18:30:00+00:00'])).toEqual(['2026-07-02T10:30:00.000Z']);
    // DHL eCommerce keeps no local clock, so the bare brand has no zone of its own.
    expect(scans(['DHL'], ['2026-07-02T18:30:00+00:00'])).toEqual(['2026-07-02T18:30:00.000Z']);
    expect(parseParcelsAppResponse({ carriers: ['DHL'], states: [{ date: '2026-07-02T18:30:00+00:00', status: 'In transit', carrier: 0 }] },
      number, identity(), 'Europe/Zurich').events?.[0]?.time).toBe('2026-07-02T16:30:00.000Z');
  });

  it('reports the carriers it aggregated and resolves a bare brand with the number', () => {
    const reply = (carriers: string[]) => ({
      carriers, services: carriers.map((name) => ({ slug: name.toLowerCase().replace(/ /g, '-'), name, isFinished: true })),
      states: [{ date: '2026-07-02T08:30:00+00:00', status: 'Delivered', carrier: 0 }],
    });
    // A Swiss DPD depot prefix picks DPD Switzerland out of the DPD networks.
    const swiss = '06080000000002';
    expect(parseParcelsAppResponse(reply(['DPD Group']), swiss, identity(swiss))).toMatchObject({
      reported_carriers: ['DPD Group'], discovered_carrier: 'dpd',
    });
    // Another depot matches both DPD networks: the brand stays a hint only.
    const austrian = '06200000000002';
    const unresolved = parseParcelsAppResponse(reply(['DPD Group']), austrian, identity(austrian));
    expect(unresolved.reported_carriers).toEqual(['DPD Group']);
    expect(unresolved.discovered_carrier).toBeUndefined();
    // Two carriers on one journey never pick one.
    const journey = reply(['Swiss Post', 'DPD Group']);
    journey.states.push({ date: '2026-07-01T16:00:00+00:00', status: 'In transit', carrier: 1 });
    expect(parseParcelsAppResponse(journey, swiss, identity(swiss)).discovered_carrier).toBeUndefined();
    expect(parseParcelsAppResponse(reply(['Swiss Post']), number, identity()).discovered_carrier).toBe('swiss-post');
  });

  it('takes the hint from the carrier every scan names, not from carriers asked without an answer', () => {
    // Live shape (2026-09-28): the carriers ParcelsApp tried, with every scan from one of them.
    const reply = (carriers: string[], states: Record<string, unknown>[]) => parseParcelsAppResponse({
      carriers, services: carriers.map((name) => ({ slug: name.toLowerCase(), name })), states,
    }, '123456784', identity('123456784'));
    const scan = (carrier?: number) => ({ date: '2026-07-02T08:30:00+00:00', status: 'Shipment in transit', ...(carrier === undefined ? {} : { carrier }) });
    expect(reply(['TNT', 'TNT', 'Example Transport'], [scan(0), scan(1)])).toMatchObject({
      reported_carriers: ['TNT', 'Example Transport'], discovered_carrier: 'tnt',
    });
    expect(reply(['TNT', 'Example Transport'], [scan(0), scan(1)]).discovered_carrier).toBeUndefined();
    expect(reply(['TNT', 'Example Transport'], [scan(0), scan()]).discovered_carrier).toBeUndefined();
    expect(reply(['Example Transport', 'TNT'], [scan(0)]).discovered_carrier).toBeUndefined();
  });

  it('reads scans named "Finland Post" on Posti\'s clock and proposes Posti', () => {
    // The name is the catalog's Posti, so its scans take the carrier's zone
    // before their own location, as every catalog carrier's do.
    const finnish = 'RR123456785FI';
    const reply = (carriers: string[]) => parseParcelsAppResponse({
      carriers,
      states: [
        { date: '2026-07-03T14:20:00+00:00', status: 'Item has left the country of origin', carrier: 0, location: 'Example Hub, Germany' },
        { date: '2026-07-02T18:30:00+00:00', status: 'Item is being transported', carrier: 0 },
        { date: '2026-01-14T09:15:00+00:00', status: 'Item registered', carrier: 0 },
      ],
    }, finnish, identity(finnish));
    const named = reply(['Finland Post']);
    expect(named.events?.map((scan) => scan.time)).toEqual([
      '2026-07-03T11:20:00.000Z', // located abroad, still 14:20 in Helsinki
      '2026-07-02T15:30:00.000Z', // summer: EEST
      '2026-01-14T07:15:00.000Z', // winter: EET
    ]);
    expect(named).toMatchObject({ reported_carriers: ['Finland Post'], discovered_carrier: 'posti' });
    expect(reply(['Posti']).events?.map((scan) => scan.time)).toEqual(named.events?.map((scan) => scan.time));
    // A second listed name, here the postal union's feed, changes nothing when every scan names Finland Post.
    expect(reply(['Finland Post', 'Universal Postal Union'])).toMatchObject({
      reported_carriers: ['Finland Post', 'Universal Postal Union'], discovered_carrier: 'posti',
    });
    // A name outside the catalog keeps the labeled instant, or its location's clock.
    expect(reply(['Example Parcel Co']).events?.map((scan) => scan.time)).toEqual([
      '2026-07-03T12:20:00.000Z', '2026-07-02T18:30:00.000Z', '2026-01-14T09:15:00.000Z',
    ]);
  });

  it('reads scans named "Spain Post" on Correos\'s Madrid clock and proposes Correos', () => {
    // ParcelsApp relays Correos' wall clocks labelled as UTC, under its own name for the operator.
    const spanish = 'RR123456785ES';
    const reply = parseParcelsAppResponse({
      carriers: ['Spain Post'],
      states: [
        { date: '2026-07-02T18:30:00Z', status: 'En reparto', carrier: 0, location: '2830594' },
        { date: '2026-01-14T09:15:00Z', status: 'Admitido', carrier: 0 },
      ],
    }, spanish, identity(spanish));
    expect(reply.events?.map((scan) => scan.time)).toEqual([
      '2026-07-02T16:30:00.000Z', // summer: CEST
      '2026-01-14T08:15:00.000Z', // winter: CET
    ]);
    expect(reply).toMatchObject({ reported_carriers: ['Spain Post'], discovered_carrier: 'correos-spain' });
  });

  it('reads DHL Express scans on the clock of the facility their location names', () => {
    // Live shape (2026-10-06): the facility's clock labeled UTC. Ship24 gives the
    // same clocks with the offsets below.
    const state = (location?: string, date = '2026-10-05T12:00:00Z') => ({ date, status: 'Processed', carrier: 0, ...(location ? { location } : {}) });
    const scans = (states: unknown[], carriers = ['DHL Express']) => parseParcelsAppResponse({ carriers, states }, number, identity());
    const scan = (location?: string, carriers?: string[]) => scans([state(location)], carriers).events?.[0]?.time;
    expect(scan('EXAMPLE CITY - FRANCE')).toBe('2026-10-05T10:00:00.000Z');
    expect(scan('EXAMPLE CITY - NETHERLANDS, THE')).toBe('2026-10-05T10:00:00.000Z');
    expect(scan('EXAMPLE-CITY - UK')).toBe('2026-10-05T11:00:00.000Z');
    expect(scan('EXAMPLE HUB - Ohio - USA')).toBe('2026-10-05T16:00:00.000Z');
    expect(scan('EXAMPLE GATEWAY - California - USA')).toBe('2026-10-05T19:00:00.000Z');
    expect(scan('EXAMPLE CITY - VIRGINIA,VA - USA')).toBe('2026-10-05T16:00:00.000Z');
    expect(scan('EXAMPLE CITY - ON - CANADA')).toBe('2026-10-05T16:00:00.000Z');
    expect(scan('EXAMPLE SERVICE AREA - ONTARIO - CANADA')).toBe('2026-10-05T16:00:00.000Z');
    expect(scan('TENERIFE - SPAIN')).toBe('2026-10-05T11:00:00.000Z');
    // The shape is DHL Express's own: another carrier's label stands.
    expect(scan('EXAMPLE CITY - FRANCE', ['Example Parcel Co'])).toBe('2026-10-05T12:00:00.000Z');
  });

  it('gives no instant to a DHL Express clock whose facility it cannot place', () => {
    const state = (location: string | undefined, date: string) => ({ date, status: 'Processed', carrier: 0, ...(location ? { location } : {}) });
    const scans = (states: unknown[]) => parseParcelsAppResponse({ carriers: ['DHL Express'], states }, number, identity());
    // An older one is left out and counted.
    const earlier = scans([state('EXAMPLE CITY - FRANCE', '2026-10-05T12:00:00Z'), state('EXAMPLE CITY - USA', '2026-10-03T12:00:00Z')]);
    expect(earlier).toMatchObject({ undated_event_count: 1, last_update: '2026-10-05T10:00:00.000Z' });
    expect(earlier.events).toHaveLength(1);
    // The latest one leaves the reply unable to say where the parcel is, whatever the order of its states.
    for (const location of ['EXAMPLE CITY - USA', 'EXAMPLE CITY - EXAMPLELAND', 'EXAMPLE CITY', undefined]) {
      expect(() => scans([state(location, '2026-10-05T12:00:00Z')])).toThrow(IndeterminateError);
      expect(() => scans([state('EXAMPLE CITY - FRANCE', '2026-10-03T12:00:00Z'), state(location, '2026-10-05T12:00:00Z')])).toThrow(IndeterminateError);
    }
    // The rendered page prints no location at all.
    expect(() => parseParcelsAppHtml(rendered(carrierRow('05 Oct 2026', '12:00', 'Processed', 'DHL Express')), number)).toThrow(IndeterminateError);
  });

  it('keeps the UTC instants ParcelsApp gives TNT international scans', () => {
    // Checked against tnt.com's offsets (2026-09-28); a TNT France number keeps the French clock.
    const scan = (trackingNumber: string) => parseParcelsAppResponse({
      carriers: ['TNT'], states: [{ date: '2026-07-02T11:20:00+00:00', status: 'Shipment in transit', carrier: 0, location: 'Example Hub, China' }],
    }, trackingNumber, identity(trackingNumber)).events?.[0]?.time;
    expect(scan('123456784')).toBe('2026-07-02T11:20:00.000Z');
    expect(scan('1000000000000001')).toBe('2026-07-02T09:20:00.000Z');
  });

  it.each(['json', 'html'])('keeps the UTC instants ParcelsApp gives Paack scans, with the stages of Paack\'s own lookup (%s)', (transport) => {
    // Live shape (2026-10-07): Paack's labels at Paack's own instants, located
    // only by country. Read on the Paris clock they came out two hours early.
    const states = [
      { date: '2026-07-02T15:40:00Z', status: 'In Paack’s distribution centre', carrier: 0, location: 'FR' },
      { date: '2026-07-02T09:15:00Z', status: 'Order details received', carrier: 0, location: 'FR' },
    ];
    const page = rendered([carrierRow('02 Jul 2026', '15:40', 'In Paack’s distribution centre', 'Paack'),
      carrierRow('02 Jul 2026', '09:15', 'Order details received', 'Paack')].join(''));
    const result = transport === 'json'
      ? parseParcelsAppResponse({ carriers: ['Paack'], states }, number, identity(), 'Europe/Paris')
      : parseParcelsAppHtml(page, number, 'Europe/Paris');
    expect(result.events?.map((scan) => [scan.time, scan.description, scan.stage, scan.stage_source])).toEqual([
      ['2026-07-02T15:40:00.000Z', 'Shipment accepted', 'accepted', 'carrier_map'],
      ['2026-07-02T09:15:00.000Z', 'Shipment registered', 'registered', 'carrier_map'],
    ]);
    expect(result).toMatchObject({ status: 'in_transit', current_stage: 'accepted', discovered_carrier: 'paack' });
  });

  it('reads Asendia scans filed under another name in their place\'s clock, not as UTC', () => {
    // Live shape (2026-09-30): an eBay shipment whose Asendia scans ParcelsApp
    // files under "EasyShip", on local clocks. Ship24's instants agree.
    const result = parseParcelsAppResponse({
      carriers: ['Asendia United States', 'EasyShip'],
      states: [
        { date: '2026-03-20T06:40:00Z', status: 'Arrived at delivery centre', carrier: 1, location: 'Japan, Japan' },
        { date: '2026-03-12T05:20:00Z', status: 'Departure transit facility', carrier: 1, location: 'Switzerland, Switzerland' },
        { date: '2026-03-05T18:45:10Z', status: 'Dispatched by Asendia', carrier: 1, location: 'United States, United States' },
        { date: '2026-03-04T22:30:00Z', status: 'Check-in Asendia facility', carrier: 1, location: 'EXAMPLE CITY, IL, United States' },
      ],
    }, number, identity());
    expect(result.events?.map((scan) => scan.time)).toEqual([
      '2026-03-19T21:40:00.000Z', // 06:40 in Tokyo
      '2026-03-12T04:20:00.000Z', // 05:20 in Zurich
      '2026-03-05T18:45:10.000Z', // a US local clock with no state: as labeled
      '2026-03-05T04:30:00.000Z', // 22:30 in Illinois
    ]);
  });

  it('tells a state or province from the country its code also names by the town', () => {
    // UPS writes US scans as "City, IL" and German ones as "City, DE": only the town tells.
    const times = (carriers: string[], states: Record<string, unknown>[]) =>
      parseParcelsAppResponse({ carriers, states }, number, identity()).events?.map((scan) => scan.time);
    const scan = (date: string, location: string) => ({ date, status: 'In transit', carrier: 0, location });
    expect(times(['UPS'], [
      scan('2026-07-02T09:00:00Z', 'Wilmington, DE'),
      scan('2026-07-02T14:05:00Z', 'Example Hub, DE'),
      scan('2026-07-01T22:10:00Z', 'Hodgkins, IL'),
      scan('2026-07-01T08:00:00Z', 'Tel Aviv, IL'),
      scan('2026-06-30T06:00:00Z', 'Indianapolis, IN'),
      scan('2026-06-30T02:00:00Z', 'Salem, IN'),
    ])).toEqual([
      '2026-07-02T13:00:00.000Z', // Delaware
      '2026-07-02T12:05:00.000Z', // no Delaware town: Germany
      '2026-07-02T03:10:00.000Z', // Illinois
      '2026-07-01T05:00:00.000Z', // Israel
      '2026-06-30T10:00:00.000Z', // Indiana
      '2026-06-29T20:30:00.000Z', // India's Salem is far bigger than Indiana's
    ]);
    // Canada's provinces, NL and SK included; "Mississauga, ON, CA" is not California.
    expect(times(['FedEx'], [
      scan('2026-07-02T14:05:00Z', 'Mississauga, ON, CA'),
      scan('2026-07-02T09:00:00Z', 'Regina, SK'),
      scan('2026-07-01T09:00:00Z', 'Example City, BC V6B 1A1'),
      scan('2026-07-01T08:00:00Z', "St. John's, NL"),
      scan('2026-06-30T08:00:00Z', 'Eindhoven, NL'),
      scan('2026-06-30T07:00:00Z', 'Bratislava, SK'),
    ])).toEqual([
      '2026-07-02T18:05:00.000Z', // Ontario
      '2026-07-02T15:00:00.000Z', // Saskatchewan, no summer time
      '2026-07-01T16:00:00.000Z', // British Columbia
      '2026-07-01T10:30:00.000Z', // Newfoundland
      '2026-06-30T06:00:00.000Z', // the Netherlands
      '2026-06-30T05:00:00.000Z', // Slovakia
    ]);
    // A location that names no place leaves the reply in North America.
    expect(times(['UNI Express'], [scan('2026-11-11T20:34:39Z', 'Example Town IL'), scan('2026-11-06T16:50:03Z', 'UNI DATA CENTER')]))
      .toEqual(['2026-11-12T02:34:39.000Z', '2026-11-06T16:50:03.000Z']);
  });

  it('reads the US scans of carriers that relay local clocks in their state\'s zone', () => {
    // Live shapes (2026-09-30): UPS's own instants, FedEx's own page and
    // UniUni's own feed agree with these readings.
    const times = (carriers: string[], states: Record<string, unknown>[]) =>
      parseParcelsAppResponse({ carriers, states }, number, identity()).events?.map((scan) => scan.time);
    const scan = (date: string, location: string, status = 'In transit', carrier = 0) => ({ date, status, carrier, location });
    expect(times(['UPS'], [
      scan('2026-07-02T14:05:00Z', 'Example City, CA, US'),
      scan('2026-07-01T09:30:00Z', 'Example City, NY 10001'),
      scan('2026-06-30T20:15:00Z', 'Example City, GA'),
      scan('2026-06-29T08:00:00Z', 'Example City, DE'),
      scan('2026-01-15T09:30:00Z', 'Example City, NY'),
    ])).toEqual([
      '2026-07-02T21:05:00.000Z', // Pacific
      '2026-07-01T13:30:00.000Z', // Eastern
      '2026-07-01T00:15:00.000Z', // Georgia, as the reply is in the US
      '2026-06-29T06:00:00.000Z', // DE names Germany first, as UPS writes it for German scans
      '2026-01-15T14:30:00.000Z', // Eastern, in winter
    ]);
    // Every located scan in a US state places the reply in the US; one abroad does not.
    expect(times(['FedEx'], [scan('2026-09-08T10:09:00Z', 'Example City, KY'), scan('2026-09-07T23:37:00Z', 'Example City, TN')]))
      .toEqual(['2026-09-08T14:09:00.000Z', '2026-09-08T04:37:00.000Z']);
    expect(times(['FedEx'], [scan('2026-09-08T10:09:00Z', 'Example City, GA'), scan('2026-09-07T08:00:00Z', 'Example Hub, France')]))
      .toEqual(['2026-09-08T10:09:00.000Z', '2026-09-07T06:00:00.000Z']);
    // OnTrac's dates are already UTC.
    expect(times(['OnTrac'], [scan('2026-09-25T21:49:19Z', 'EXAMPLE CITY, CA, 92000'), scan('2026-09-24T02:25:10Z', 'EXAMPLE CITY, NY, 10001')]))
      .toEqual(['2026-09-25T21:49:19.000Z', '2026-09-24T02:25:10.000Z']);
    // UniUni writes "City ST"; a copy of the same scan from another carrier moves with it.
    expect(parseParcelsAppResponse({ carriers: ['UNI Express', 'Cainiao'], states: [
      scan('2026-09-05T15:10:54Z', 'Example Township PA', 'Delivered. (Recipient\'s front door)'),
      scan('2026-09-05T15:10:54Z', '', 'Package delivered,front door/porch', 1),
      scan('2026-09-04T21:31:33Z', 'Example City NY', 'Gateway transit out'),
    ] }, number, identity()).events?.map((event) => [event.time, event.description])).toEqual([
      ['2026-09-05T19:10:54.000Z', 'Delivered'],
      ['2026-09-05T01:31:33.000Z', 'Gateway transit out'],
    ]);
  });

  it('reads USPS, Canada Post, GOFO and SpeedPAK scans in the state, province or country their location names', () => {
    // Live shapes (2026-10-10): each carrier's local clock labeled UTC. USPS's
    // page, Canada Post's digits, GOFO's US feed and Orange Connex's offsets
    // agree with these readings.
    const times = (carriers: string[], states: Record<string, unknown>[]) =>
      parseParcelsAppResponse({ carriers, states }, number, identity()).events?.map((scan) => scan.time);
    const scan = (date: string, location: string, status = 'In transit', carrier = 0) => ({ date, status, carrier, location });
    expect(times(['USPS'], [
      scan('2026-09-11T08:25:00Z', 'EXAMPLE CITY, NY 10001'),
      scan('2026-09-02T08:53:00Z', 'EXAMPLE CITY MI DISTRIBUTION CENTER'),
      scan('2026-08-28T05:01:00Z', 'EXAMPLE CITY CA NETWORK DISTRIBUTION CENTER'),
    ])).toEqual(['2026-09-11T12:25:00.000Z', '2026-09-02T12:53:00.000Z', '2026-08-28T12:01:00.000Z']);
    expect(times(['Canada Post'], [
      scan('2026-10-03T11:55:00Z', 'ISC EXAMPLE CITY IL (USPS), USA'),
      scan('2026-10-01T12:58:00Z', 'EXAMPLE CITY, ON, Canada'),
    ])).toEqual(['2026-10-03T16:55:00.000Z', '2026-10-01T16:58:00.000Z']);
    expect(times(['SpeedPAK'], [
      scan('2026-02-18T13:12:47Z', 'Example City Minnesota, United States of America'),
      scan('2026-02-02T21:42:33Z', 'Example City Il, United States of America'),
      scan('2026-01-28T11:47:02Z', 'Example City, People\'s Republic of China'),
    ])).toEqual(['2026-02-18T19:12:47.000Z', '2026-02-03T03:42:33.000Z', '2026-01-28T03:47:02.000Z']);
    // GOFO's US scans; a copy from another carrier, with no state, moves with its scan.
    expect(parseParcelsAppResponse({ carriers: ['GoFo Express', 'Cainiao'], states: [
      scan('2026-10-03T16:01:13Z', 'Example City, FL', 'Delivered, Door/Yard.'),
      scan('2026-10-03T16:01:13Z', 'Example City', 'Delivered', 1),
      scan('2026-10-03T08:54:20Z', 'Example City, FL', 'Out for Delivery'),
    ] }, number, identity()).events?.map((event) => [event.time, event.description])).toEqual([
      ['2026-10-03T20:01:13.000Z', 'Delivered'],
      ['2026-10-03T12:54:20.000Z', 'Out for Delivery'],
    ]);
  });

  it('lends a wall-clock scan with no place the clock of its network\'s nearest placed scan, as a guess', () => {
    const times = (carriers: string[], states: Record<string, unknown>[], timezone: string | null = null) =>
      parseParcelsAppResponse({ carriers, states }, number, identity(), timezone).events?.map((scan) => scan.time);
    const scan = (date: string, location?: string, carrier = 0) => ({ date, status: 'In transit', carrier, ...(location ? { location } : {}) });
    // The scan just before it; for the first scans, the one just after.
    expect(times(['USPS'], [
      scan('2026-08-30T23:05:00Z'),
      scan('2026-08-30T18:00:00Z', 'EXAMPLE CITY IN DISTRIBUTION CENTER'),
      scan('2026-08-28T11:42:00Z'),
      scan('2026-08-28T05:01:00Z', 'EXAMPLE CITY CA DISTRIBUTION CENTER'),
      scan('2026-08-23T21:51:00Z'),
    ])).toEqual([
      '2026-08-31T03:05:00.000Z', // Eastern, from Indiana
      '2026-08-30T22:00:00.000Z',
      '2026-08-28T18:42:00.000Z', // Pacific, from California
      '2026-08-28T12:01:00.000Z',
      '2026-08-24T04:51:00.000Z', // Pacific, from the scan after it
    ]);
    // Only a zone the location allows: a scan in the US skips a Canadian or a Chinese one.
    expect(times(['Canada Post'], [
      scan('2026-10-10T06:10:00Z', 'USA'),
      scan('2026-10-03T11:55:00Z', 'ISC EXAMPLE CITY IL (USPS), USA'),
      scan('2026-10-02T01:11:00Z', 'EXAMPLE-A, Canada'),
      scan('2026-10-01T12:58:00Z', 'EXAMPLE CITY, ON, Canada'),
    ])).toEqual(['2026-10-10T11:10:00.000Z', '2026-10-03T16:55:00.000Z', '2026-10-02T05:11:00.000Z', '2026-10-01T16:58:00.000Z']);
    expect(times(['SpeedPAK'], [
      scan('2026-02-02T21:42:33Z', 'Example City Il, United States of America'),
      scan('2026-02-02T10:09:00Z', 'United States of America'),
      scan('2026-01-31T17:07:00Z', 'People\'s Republic of China'),
    ])).toEqual(['2026-02-03T03:42:33.000Z', '2026-02-02T16:09:00.000Z', '2026-01-31T09:07:00.000Z']);
    // 4PX's "US" alone takes the US scan before it.
    expect(parseParcelsAppResponse({ carriers: ['4PX Express'], states: [
      { date: '2026-05-25T01:36:43Z', status: 'Arrived at usps regional facility', carrier: 0, location: 'US    EXAMPLE CITY NY DISTRIBUTION CENTER' },
      { date: '2026-05-24T23:39:05Z', status: 'In transit to next facility', carrier: 0, location: 'US    ' },
      { date: '2026-05-24T22:10:36Z', status: 'Departed usps regional facility', carrier: 0, location: 'US    EXAMPLE CITY NY DISTRIBUTION CENTER' },
    ] }, number, identity()).events?.map((event) => event.time))
      .toEqual(['2026-05-25T13:36:43.000Z', '2026-05-25T11:39:05.000Z', '2026-05-25T10:10:36.000Z']);
    // With nothing to borrow, routing's zone, unless the location rules it out.
    expect(times(['EMS'], [scan('2026-09-11T23:38:00+00:00', 'Example Office')], 'Europe/London')).toEqual(['2026-09-11T22:38:00.000Z']);
    expect(times(['EMS'], [scan('2026-09-11T23:38:00+00:00', 'Example Office'), scan('2026-09-10T11:36:00+00:00', 'Example City, Germany')],
      'Europe/London')).toEqual(['2026-09-11T21:38:00.000Z', '2026-09-10T09:36:00.000Z']);
    expect(times(['EMS'], [scan('2026-09-11T23:38:00+00:00', 'United States')], 'Europe/London')).toEqual(['2026-09-11T23:38:00.000Z']);
    // Canada Post's "USA" names the US for other carriers' guesses too.
    expect(times(['Royal Mail'], [scan('2026-09-11T23:38:00Z', 'Example City, USA')])).toEqual(['2026-09-11T23:38:00.000Z']);
  });

  it('copies a placed scan of another carrier, reads known clocks, and keeps the label of a wall-clock scan with no other zone', () => {
    const reply = (carriers: string[], states: Record<string, unknown>[]) => parseParcelsAppResponse({ carriers, states }, number, identity());
    const scan = (date: string, location?: string, carrier = 0, status = 'In transit') => ({ date, status, carrier, ...(location ? { location } : {}) });
    // The same digits and wording as another carrier's placed scan: a copy, on
    // its clock, and one scan with it. A scan of the network before it lends
    // that clock to the next with other wording.
    expect(reply(['EMS', 'Japan Post'], [
      scan('2026-07-08T14:50:00+00:00', '10001', 0, 'Delivered'),
      scan('2026-07-08T14:50:00Z', 'UNITED KINGDOM', 1, 'Delivered'),
      scan('2026-07-08T06:11:00+00:00', '10001', 0, 'Out for delivery'),
      scan('2026-07-08T06:11:00Z', 'UNITED KINGDOM', 1, 'Item out for physical delivery'),
    ]).events?.map((event) => [event.time, event.description])).toEqual([
      ['2026-07-08T13:50:00.000Z', 'Delivered'],
      ['2026-07-08T05:11:00.000Z', 'Out for delivery'],
      ['2026-07-08T05:11:00.000Z', 'Item out for physical delivery'],
    ]);
    // GOFO's labels on Pacific time and Cainiao's origin leg on China time,
    // whatever their neighbours; Cainiao's other scans borrow as any other.
    expect(reply(['GoFo Express', 'Cainiao'], [
      scan('2026-10-03T16:01:13Z', 'Example City, FL', 0, 'Delivered'),
      scan('2026-10-03T16:01:13Z', 'Example City', 1, 'Delivered'),
      scan('2026-10-01T21:26:36Z', undefined, 1, 'Leaving customs'),
      scan('2026-09-28T03:35:09Z', undefined, 1, 'Order received successfully'),
      scan('2026-09-27T12:34:50Z', undefined, 0, 'Shipping Label Created'),
    ]).events?.map((event) => event.time)).toEqual([
      '2026-10-03T20:01:13.000Z',
      '2026-10-02T01:26:36.000Z',
      '2026-09-27T19:35:09.000Z',
      '2026-09-27T19:34:50.000Z',
    ]);
    // With no other zone, ParcelsApp's label, as before these steps: never an undated scan.
    for (const [carriers, states] of [
      [['Canada Post'], [scan('2026-10-10T06:10:00Z', 'USA'), scan('2026-10-01T12:58:00Z', 'EXAMPLE CITY, ON, Canada')]],
      [['USPS', 'UPS'], [scan('2026-10-10T06:10:00Z'), scan('2026-10-04T15:24:00Z', 'Example City, NY', 1)]],
      [['EMS'], [scan('2026-10-10T06:10:00Z', '10001'), scan('2026-10-04T15:24:00Z', 'EXAMPLE CITY')]],
      [['Cainiao'], [scan('2026-10-10T06:10:00Z'), scan('2026-10-04T15:24:00Z', 'Example Town')]],
      [['EcoScooting'], [scan('2026-10-10T06:10:00Z'), scan('2026-10-04T15:24:00Z')]],
    ] as const) {
      const result = reply([...carriers], [...states]);
      expect(result, carriers.join()).toMatchObject({ last_update: '2026-10-10T06:10:00.000Z' });
      expect(result.undated_event_count, carriers.join()).toBeUndefined();
    }
    // 4PX's label is its own instant: China time.
    expect(reply(['4PX Express'], [scan('2026-05-23T10:00:38Z')]).last_update).toBe('2026-05-23T10:00:38.000Z');
    // The rendered page prints no location: routing's zone, a known clock, or the label.
    const page = rendered(carrierRow('10 Oct 2026', '06:10', 'Out for delivery', 'USPS')
      + carrierRow('27 Sep 2026', '12:34', 'Shipping Label Created', 'GoFo Express'));
    expect(parseParcelsAppHtml(page, number).events?.map((event) => event.time)).toEqual(['2026-10-10T06:10:00.000Z', '2026-09-27T19:34:00.000Z']);
    expect(parseParcelsAppHtml(page, number, 'America/New_York').events?.[0]?.time).toBe('2026-10-10T10:10:00.000Z');
  });

  it('reads 4PX scans on the wall clock its instants give on China time', () => {
    // Live shape (2026-10-10): 4PX's fixed fields and its own instants, which
    // read each wall clock on China time, a US one too. 4PX's page gives the
    // offsets: its scans up to the departing flight on China time, the rest in
    // the US.
    const result = parseParcelsAppResponse({ carriers: ['4PX Express'], destinationCode: 'US', states: [
      { date: '2026-05-26T06:30:03Z', status: 'Delivered, in/at mailbox', carrier: 0, location: 'US  NY  EXAMPLE CITY 10001' },
      { date: '2026-05-25T01:36:43Z', status: 'Arrived at usps regional facility', carrier: 0, location: 'US    EXAMPLE CITY NY DISTRIBUTION CENTER' },
      { date: '2026-05-23T10:00:38Z', status: 'Customs clearance agent received the shipment in destnation country.\n', carrier: 0 },
      { date: '2026-05-23T04:22:00Z', status: 'Arrival to the destination airport', carrier: 0 },
      { date: '2026-05-22T17:27:00Z', status: 'Departure from the original airport', carrier: 0 },
      { date: '2026-05-21T12:35:30Z', status: 'Pickup scanned, in transit to warehouse', carrier: 0, location: 'CN' },
      { date: '2026-05-21T09:08:01Z', status: 'Shipping label created, usps awaiting item', carrier: 0, location: 'US  NY  EXAMPLE CITY 10001' },
      { date: '2026-05-21T09:04:13Z', status: 'Parcel information received', carrier: 0 },
    ] }, number, identity());
    expect(result.events?.map((scan) => [scan.time, scan.location])).toEqual([
      ['2026-05-26T18:30:03.000Z', 'US NY EXAMPLE CITY 10001'], // 14:30:03 in New York
      ['2026-05-25T13:36:43.000Z', 'US EXAMPLE CITY NY DISTRIBUTION CENTER'],
      // In the US, from the US scans after them, as guesses: 18:00:38 and
      // 12:22 in New York on 4PX's page.
      ['2026-05-23T22:00:38.000Z', undefined],
      ['2026-05-23T16:22:00.000Z', undefined],
      ['2026-05-22T17:27:00.000Z', undefined], // China time, as labeled
      ['2026-05-21T21:08:01.000Z', 'US NY EXAMPLE CITY 10001'], // the US label, 17:08:01 in New York
      ['2026-05-21T12:35:30.000Z', 'CN'],
      ['2026-05-21T09:04:13.000Z', undefined], // China time, not the label's US one after it
    ]);
    expect(result.undated_event_count).toBeUndefined();
  });

  it('reads 4PX scans whose places ParcelsApp rewrote on the wall clock of their dates', () => {
    // Live shape (2026-10-11): "United States", "Hong Kong", "US 12345" in
    // place of 4PX's fields, and dates that are the wall clocks themselves.
    // 4PX's page gives the offsets.
    const result = parseParcelsAppResponse({ carriers: ['4PX Express'], destination: 'United States', states: [
      { date: '2026-03-23T13:49:00Z', status: 'Delivered, front door/porch', carrier: 0, location: 'EXAMPLE CITY, IN, US 12345' },
      { date: '2026-03-21T09:40:00Z', status: 'Arrived at usps regional facility', carrier: 0,
        location: 'EXAMPLE CITY IN DISTRIBUTION CENTER, US 12345' },
      { date: '2026-03-19T21:35:00Z', status: 'Handed over to last mile', carrier: 0 },
      { date: '2026-03-18T03:06:00Z', status: 'Hand over to airline', carrier: 0 },
      { date: '2026-03-17T09:53:32Z', status: 'Depart from facility to service provider', carrier: 0, location: 'Hong Kong' },
      { date: '2026-03-14T02:40:00Z', status: 'Picked up by shipping partner, usps awaiting item', carrier: 0, location: 'EXAMPLE CITY, IL, US 12345' },
      { date: '2026-03-09T15:04:41Z', status: 'Parcel information received', carrier: 0 },
    ] }, number, identity());
    expect(result.events?.map((scan) => scan.time)).toEqual([
      '2026-03-23T17:49:00.000Z', // 13:49 in Indiana
      '2026-03-21T13:40:00.000Z',
      '2026-03-20T02:35:00.000Z', // in the US: Illinois's clock, from the scan before it, a guess
      '2026-03-17T19:06:00.000Z',
      '2026-03-17T01:53:32.000Z',
      '2026-03-14T07:40:00.000Z',
      '2026-03-09T07:04:41.000Z',
    ]);
    expect(result.undated_event_count).toBeUndefined();
  });

  it('reads Cainiao\'s import customs and last mile on the destination\'s clock, the UK\'s last mile as labeled', () => {
    // Cainiao's own feed (2026-10-11): its origin leg on China time, import
    // customs and the last mile on the destination's clock, the UK's last mile
    // on GMT in July.
    const times = (destinationCode: string, states: Record<string, unknown>[]) =>
      parseParcelsAppResponse({ carriers: ['Cainiao'], destinationCode, states }, number, identity()).events?.map((scan) => scan.time);
    const scan = (date: string, status: string, location?: string) => ({ date, status, carrier: 0, ...(location ? { location } : {}) });
    const states = [
      scan('2026-07-10T14:00:00Z', 'Delivered'),
      scan('2026-07-08T09:00:00Z', 'Import customs clearance complete'),
      scan('2026-07-01T10:00:00Z', 'Leave the warehouse'),
    ];
    expect(times('BE', states)).toEqual(['2026-07-10T12:00:00.000Z', '2026-07-08T07:00:00.000Z', '2026-07-01T02:00:00.000Z']);
    expect(times('GB', states)).toEqual(['2026-07-10T14:00:00.000Z', '2026-07-08T08:00:00.000Z', '2026-07-01T02:00:00.000Z']);
    // A destination of several clocks lends only the clock of a scan placed
    // there, as a guess, and none from outside it.
    expect(times('US', [
      scan('2026-10-03T16:01:13Z', 'In transit', 'Example City, FL'),
      scan('2026-10-01T21:26:36Z', 'Leaving customs'),
      scan('2026-09-30T08:00:00Z', 'In transit', 'Example City, China'),
    ])).toEqual(['2026-10-03T20:01:13.000Z', '2026-10-02T01:26:36.000Z', '2026-09-30T00:00:00.000Z']);
  });

  it('reads EcoScooting\'s last mile in Portugal for a "CNPRT" reference, otherwise in Spain', () => {
    // EcoScooting's own instants (2026-10-11): its China leg on China time, its
    // order and Spanish sorting center on Madrid's, its last mile on the
    // destination's.
    const times = (trackingNumber: string) => parseParcelsAppResponse({ carriers: ['EcoScooting'], states: [
      { date: '2026-07-10T09:00:00Z', status: 'Out for Delivery. Your shipment is out for delivery', carrier: 0 },
      { date: '2026-07-08T09:00:00Z', status: 'Sorting Center Inbound. Your shipment has arrived at sorting center', carrier: 0 },
      { date: '2026-07-01T09:00:00Z', status: 'Shipment is in transit to Cainiao Express', carrier: 0 },
    ] }, trackingNumber, identity(trackingNumber)).events?.map((scan) => scan.time);
    const reference = 'CNPRT00000000000000000001';
    expect(times(reference)).toEqual(['2026-07-10T08:00:00.000Z', '2026-07-08T07:00:00.000Z', '2026-07-01T01:00:00.000Z']);
    expect(times(number)).toEqual(['2026-07-10T07:00:00.000Z', '2026-07-08T07:00:00.000Z', '2026-07-01T01:00:00.000Z']);
    const page = identity(reference).replace('</table>', `</table><ul class="events">${
      carrierRow('10 Jul 2026', '09:00', 'Out for Delivery. Your shipment is out for delivery', 'EcoScooting')}</ul>`);
    expect(parseParcelsAppHtml(page, reference).events?.[0]?.time).toBe('2026-07-10T08:00:00.000Z');
  });

  it('gives copies of a GOFO scan with an offset of its own that instant', () => {
    // Live shape (2026-10-10): GOFO France's own offsets, and other carriers'
    // copies of the same scan with its digits labeled UTC.
    const result = parseParcelsAppResponse({ carriers: ['GoFo Express', 'YTO Express', 'Cirro Parcel France', 'EQuick China'], states: [
      { date: '2026-06-18T12:08:37+00:00', status: 'Delivered by Mailbox', carrier: 1, location: 'EXAMPLE CITY,EXAMPLE REGION' },
      { date: '2026-06-18T12:08:37+00:00', status: 'Delivered by Mailbox', carrier: 2, location: 'EXAMPLE CITY,EXAMPLE REGION' },
      { date: '2026-06-18T12:08:37+00:00', status: 'Delivered by Mailbox', carrier: 3, location: 'EXAMPLE CITY,EXAMPLE REGION' },
      { date: '2026-06-18T12:08:37+02:00', status: 'Delivered by Mailbox', carrier: 0, location: 'EXAMPLE CITY,EXAMPLE REGION' },
      { date: '2026-01-15T10:35:08+01:00', status: 'Arrived at sorting center', carrier: 0, location: 'EXAMPLE CITY' },
      { date: '2026-01-15T10:35:08+00:00', status: 'Arrived at sorting center', carrier: 3, location: 'EXAMPLE CITY' },
    ] }, number, identity());
    expect(result.events?.map((scan) => scan.time)).toEqual(['2026-06-18T10:08:37.000Z', '2026-01-15T09:35:08.000Z']);
    expect(result.undated_event_count).toBeUndefined();
  });

  it('reads the networks ParcelsApp names its own way on their home clock', () => {
    const times = (carriers: string[], states: Record<string, unknown>[], trackingNumber = number) =>
      parseParcelsAppResponse({ carriers, states }, trackingNumber, identity(trackingNumber)).events?.map((scan) => scan.time);
    const scan = (date: string, location?: string) => ({ date, status: 'In transit', carrier: 0, ...(location ? { location } : {}) });
    // Live shapes (2026-10-10). The network's own instants on its clock, wherever the scan was.
    expect(times(['Italy Post'], [scan('2026-10-02T10:07:00Z', 'from the operational headquarters of EXAMPLE (XX)')]))
      .toEqual(['2026-10-02T08:07:00.000Z']);
    expect(times(['New Zealand Post'], [scan('2026-01-11T07:40:00Z'), scan('2025-12-17T11:15:00Z', 'Hong Kong')]))
      .toEqual(['2026-01-10T18:40:00.000Z', '2025-12-16T22:15:00.000Z']);
    expect(times(['Singapore Post'], [scan('2026-07-07T14:44:00+00:00')])).toEqual(['2026-07-07T06:44:00.000Z']);
    expect(times(['SunYou - Sytrack'], [scan('2021-07-20T11:30:00Z', '1000')])).toEqual(['2021-07-20T03:30:00.000Z']);
    // Local clocks checked at home: another country's location comes first.
    expect(times(['South Korea Post'], [scan('2026-09-30T13:48:00Z', 'Example Post Office'), scan('2026-09-29T12:00:00Z', 'Example City, Germany')]))
      .toEqual(['2026-09-30T04:48:00.000Z', '2026-09-29T10:00:00.000Z']);
    expect(times(['Posten Norge - Norway Post'], [scan('2026-09-30T09:38:23Z'), scan('2026-09-30T06:17:37Z', 'Example Town, Denmark, 1000')]))
      .toEqual(['2026-09-30T07:38:23.000Z', '2026-09-30T04:17:37.000Z']);
    expect(times(['Royal Mail'], [scan('2026-09-16T14:39:39Z', 'Example DO')])).toEqual(['2026-09-16T13:39:39.000Z']);
    expect(times(['Japan Post'], [scan('2026-10-02T10:27:00Z', 'Example Town')])).toEqual(['2026-10-02T01:27:00.000Z']);
    // A DPD UK depot number named "DPD France": DPD UK's clock. A French one keeps Paris.
    const dpd = [scan('2026-07-22T14:17:00Z')];
    expect(times(['DPD France'], dpd, '15500000000000')).toEqual(['2026-07-22T13:17:00.000Z']);
    expect(times(['DPD France'], dpd, '10000000000000')).toEqual(['2026-07-22T12:17:00.000Z']);
    expect(parseParcelsAppHtml(rendered(carrierRow('02 Oct 2026', '10:07', 'In transit', 'Italy Post')), number).events?.[0]?.time)
      .toBe('2026-10-02T08:07:00.000Z');
  });

  it('keeps the UTC instants ParcelsApp gives Asendia USA scans wherever they happened', () => {
    // Live shape (2026-09-30): an Asendia USA return through Switzerland, filed
    // under Swiss Post. Asendia's A1 feed has the same instants, and Swiss
    // Post's own scan (its local clock shifted into "+02:00") agrees.
    const result = parseParcelsAppResponse({
      carriers: ['Swiss Post', 'Asendia United States', 'Asendia USA'],
      states: [
        { date: '2026-05-06T19:40:30+02:00', status: 'Arrival in destination country', carrier: 0, location: 'Example Centre, Switzerland, 100000' },
        { date: '2026-05-06T15:40:00Z', status: 'Arrived at destination', carrier: 1, location: 'EXAMPLE CITY, Switzerland' },
        { date: '2026-04-21T06:10:00Z', status: 'Out for delivery', carrier: 1, location: 'Germany' },
        { date: '2026-04-20T09:30:00Z', status: 'Arrived at destination', carrier: 2, location: 'EXAMPLE CITY, Germany' },
        { date: '2026-04-10T14:05:12Z', status: 'Shipment Information Received', carrier: 1 },
      ],
    }, number, identity(), 'Europe/Zurich');
    expect(result.events?.map((scan) => scan.time)).toEqual([
      '2026-05-06T15:40:30.000Z', // Swiss Post: 17:40:30 in Zurich
      '2026-05-06T15:40:00.000Z',
      '2026-04-21T06:10:00.000Z',
      '2026-04-20T09:30:00.000Z',
      '2026-04-10T14:05:12.000Z',
    ]);
  });

  it('keeps the instants of scans whose carrier resolved before brand and country names did', () => {
    // A Chronopost + DHL Parcel Netherlands handoff: the DHL scans carry no
    // location and were read in the parcel carrier's zone (Berlin). Their name
    // now reads them in Amsterdam, which keeps the same clock, so stored rows
    // keep their identity.
    const result = parseParcelsAppResponse({
      carriers: ['Chronopost France', 'DHL Parcel Netherlands'],
      states: [
        { date: '2026-07-03T11:42:00+00:00', status: 'Delivered', carrier: 0, location: 'EXAMPLE-VILLE' },
        { date: '2026-07-02T19:05:00+00:00', status: 'Handed over to the delivery partner', carrier: 1 },
        { date: '2026-03-29T01:30:00+00:00', status: 'Sorted at the parcel centre', carrier: 1 },
        { date: '2026-01-14T07:20:00+00:00', status: 'Received by the carrier', carrier: 1 },
      ],
    }, number, identity(), 'Europe/Berlin');
    expect(result.events?.map((scan) => scan.time)).toEqual([
      '2026-07-03T09:42:00.000Z',
      '2026-07-02T17:05:00.000Z',
      '2026-03-29T00:30:00.000Z',
      '2026-01-14T06:20:00.000Z',
    ]);
  });

  it('preserves the same unresolved brand clocks in rendered and JSON scans', () => {
    const swiss = '06080000000002';
    const page = identity(swiss).replace('</table>', `</table><ul class="events">${
      carrierRow('02 Jul 2026', '10:37', 'Delivered', 'DPD Group')}${carrierRow('14 Jan 2026', '09:15', 'Parcel handed', 'DPD Group')}</ul>`);
    const rendered = parseParcelsAppHtml(page, swiss);
    const json = parseParcelsAppResponse({ carriers: ['DPD Group'], states: [
      { date: '2026-07-02T10:37:00+00:00', status: 'Delivered', carrier: 0 },
      { date: '2026-01-14T09:15:00+00:00', status: 'Parcel handed', carrier: 0 },
    ] }, swiss, identity(swiss));
    expect(rendered.events?.map((scan) => scan.time)).toEqual(['2026-07-02T10:37:00.000Z', '2026-01-14T09:15:00.000Z']);
    expect(rendered.events?.map((scan) => scan.time)).toEqual(json.events?.map((scan) => scan.time));
    expect(rendered).toMatchObject({ reported_carriers: ['DPD Group'], discovered_carrier: 'dpd' });
  });

  it('parses rendered history without parsing the surrounding marketing copy', () => {
    const html = rendered(row('18 Aug 2026', '03:04', 'Electronic information submitted by shipper'));
    expect(parseParcelsAppHtml(html + '<p>Delivered 2026-09-01</p>', number))
      .toMatchObject({ current_stage: 'registered', last_update: '2026-08-18T03:04:00.000Z' });
  });

  it('skips notice rows that render a date without a time', () => {
    // Observed live on 2026-09-11 for a not-yet-scanned Colissimo label.
    const notice = row('11 Sep 2026', '', "No information about your package. We've checked all relevant couriers for «Suisse». If the country is not correct, please select the destination country below.");
    const scan = row('10 Sep 2026', '08:30', 'Electronic information submitted by shipper');
    expect(parseParcelsAppHtml(rendered(notice + scan), number)).toMatchObject({ current_stage: 'registered', last_update: '2026-09-10T08:30:00.000Z' });
    expect(() => parseParcelsAppHtml(rendered(notice), number)).toThrow('No usable tracking events');
    expect(() => parseParcelsAppHtml(rendered(row('today', '08:30', 'Electronic information submitted by shipper')), number)).toThrow('invalid event date');
  });
});

describe('ParcelsApp browser capture', () => {
  it('asks the browser service for the page and reads its captured API response', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(captured(announced));
    await expect(tracker(fetcher, 'http://browser.test/v1').fetch(number)).resolves.toMatchObject({ tracking_provider: 'ParcelsApp', current_stage: 'registered' });
    const [url, options] = fetcher.mock.calls[0]!;
    expect(String(url)).toBe('http://browser.test/scrape');
    expect(JSON.parse(String(options!.body))).toMatchObject({
      url: `https://parcelsapp.com/en/tracking/${number}`, skipHttp: true, maxTier: 3,
      captureResponses: [API], settleTimeout: 15_000,
    });
  });

  it('falls back to the rendered history when no API body was captured', async () => {
    const html = rendered(row('18 Aug 2026', '03:04', 'Electronic information submitted by shipper'));
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(captured(null, { html, capturedResponses: [] }));
    await expect(tracker(fetcher).fetch(number)).resolves.toMatchObject({ current_stage: 'registered', last_update: '2026-08-18T03:04:00.000Z' });
  });

  it('rejects a page rendered for another shipment instead of reporting its history', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(captured(announced, { html: identity('OTHER123') }));
    await expect(tracker(fetcher).fetch(number)).rejects.toThrow('identity missing');
  });

  it('needs the browser service and never requests an arbitrary user URL', async () => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(new ParcelsAppTracker({ httpClient: null }).fetch(number)).rejects.toThrow('tracking browser service');
    await expect(tracker(fetcher).fetch('http://localhost')).rejects.toThrow('Invalid tracking number');
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('ParcelsApp direct lookup', () => {
  const reply = (data: unknown) => new Response(JSON.stringify(data));
  const prompt = { states: [{ date: '2026-01-01T00:00:00', status: 'Enter recipient details',
    require_fields: [{ name: 'zipcode', type: 'text' }] }] };

  it('retrieves history without a browser and sends the stored postcode only in the form body', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(reply(announced));
    const result = await new ParcelsAppTracker({ fetcher }).fetch(number, 10_000, ' 01234 ');
    expect(result).toMatchObject({ current_stage: 'registered', tracking_source: 'structured-web-response' });
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, init] = fetcher.mock.calls[0]!;
    expect(String(url)).toBe(API);
    expect(new URLSearchParams(String(init!.body)).get('extra[zipcode]')).toBe('01234');
    expect(JSON.stringify(result)).not.toContain('01234');
  });

  it('keeps interleaved numberless responses bound to their own requests', async () => {
    let finishFirst!: (response: Response) => void;
    const fetcher = vi.fn<typeof fetch>().mockImplementationOnce(() => new Promise((resolve) => { finishFirst = resolve; }))
      .mockResolvedValueOnce(reply({ states: [{ date: '2026-01-02T12:00:00Z', status: 'Delivered' }] }));
    const tracker = new ParcelsAppTracker({ fetcher });
    const first = tracker.fetch(number);
    const second = await tracker.fetch('ZZ98765432100');
    finishFirst(reply(announced));
    expect(second.current_stage).toBe('delivered');
    expect((await first).current_stage).toBe('registered');
    expect(String(fetcher.mock.calls[0]![1]!.body)).not.toBe(String(fetcher.mock.calls[1]![1]!.body));
  });

  it('reports a postcode gate without treating it as a scan or retrying in a browser', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => reply(prompt));
    const tracker = new ParcelsAppTracker({ fetcher, trawl: new TrawlClient('http://browser.test', fetcher) });
    for (const postcode of [undefined, '99999']) {
      const error = await tracker.fetch(number, 10_000, postcode).catch((error: unknown) => error);
      expect(error).toMatchObject({ kind: 'input_required', field: 'postcode' });
      // The gate names no carrier.
      expect((error as InputRequiredError).carrier).toBeUndefined();
    }
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('names the carrier a postcode gate is for, when every gate names one that maps', async () => {
    const gate = (carrier?: number) => ({ ...prompt.states[0], ...(carrier === undefined ? {} : { carrier }) });
    const gated = async (data: unknown) => new ParcelsAppTracker({ fetcher: vi.fn<typeof fetch>().mockResolvedValue(reply(data)) })
      .fetch(number).catch((error: unknown) => error);
    expect(await gated({ carriers: ['SEUR'], states: [gate(0)] }))
      .toMatchObject({ name: 'InputRequiredError', kind: 'input_required', field: 'postcode', carrier: 'seur' });
    expect(await gated({ carriers: ['bpost', 'bpost'], states: [gate(0), gate(1)] })).toMatchObject({ field: 'postcode', carrier: 'bpost' });
    for (const data of [
      { carriers: ['Example Courier'], states: [gate(0)] },
      { carriers: ['SEUR', 'bpost'], states: [gate(0), gate(1)] },
      { carriers: ['SEUR'], states: [gate(0), gate()] },
      { carriers: ['SEUR'], states: [gate(3)] },
    ]) {
      const error = await gated(data);
      expect(error).toMatchObject({ kind: 'input_required', field: 'postcode' });
      expect((error as InputRequiredError).carrier).toBeUndefined();
    }
  });

  it('returns the dated history of a reply with an undated state, without a browser retry', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(reply(undatedLeg));
    await expect(new ParcelsAppTracker({ fetcher, trawl: new TrawlClient('http://browser.test', fetcher) }).fetch(number))
      .resolves.toMatchObject({ tracking_source: 'structured-web-response', undated_event_count: 1 });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('retains actual scans alongside a postcode gate', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(reply({ states: [...prompt.states, ...announced.states] }));
    const result = await new ParcelsAppTracker({ fetcher }).fetch(number);
    expect(result.events).toHaveLength(1);
    expect(result.current_stage).toBe('registered');
  });

  it('records challenge recovery and retains the browser identity check', async () => {
    const steps: StepRecord[] = [];
    const lookups: LookupRecord[] = [];
    const recorder: StepRecorder = { step: (record) => { steps.push(record); }, lookup: (record) => { lookups.push(record); } };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(reply({ error: 'RELOAD' })).mockResolvedValueOnce(captured(announced));
    const result = await new ParcelsAppTracker({ fetcher, recorder, trawl: new TrawlClient('http://browser.test', fetcher) }).fetch(number);
    expect(result.current_stage).toBe('registered');
    expect(steps).toMatchObject([{ step: 'direct', outcome: 'challenge' }, { step: 'trawl', outcome: 'ok', fallbackFrom: 'direct' }]);
    expect(lookups).toMatchObject([{ finalStep: 'trawl', attempts: 2, outcome: 'ok' }]);

    fetcher.mockResolvedValueOnce(reply({ error: 'RELOAD' })).mockResolvedValueOnce(captured(announced, { html: identity('OTHER123') }));
    await expect(new ParcelsAppTracker({ fetcher, trawl: new TrawlClient('http://browser.test', fetcher) }).fetch(number)).rejects.toThrow('identity missing');
  });

  it('reads a direct reply past the size cap through the browser, which accepts a larger one', async () => {
    const steps: StepRecord[] = [];
    const recorder: StepRecorder = { step: (record) => { steps.push(record); }, lookup: () => {} };
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('x', { headers: { 'content-length': '3000000' } }))
      .mockResolvedValueOnce(captured(announced));
    const result = await new ParcelsAppTracker({ fetcher, recorder, trawl: new TrawlClient('http://browser.test', fetcher) }).fetch(number);
    expect(result.current_stage).toBe('registered');
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(steps).toMatchObject([
      { step: 'direct', outcome: 'indeterminate' },
      { step: 'trawl', outcome: 'ok', fallbackFrom: 'direct', fallbackReason: 'indeterminate' },
    ]);
  });

  it('starts no browser lookup for a reply within the cap that carries no usable scan', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(reply({ states: [{ date: '2026-01-01T00:00:00Z', status: 'Tracking number not found' }] }));
    await expect(new ParcelsAppTracker({ fetcher, trawl: new TrawlClient('http://browser.test', fetcher) }).fetch(number))
      .rejects.toMatchObject({ kind: 'indeterminate', message: 'No usable tracking events' });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it.each([429, 500, 503])('does not amplify HTTP %i with a browser retry', async (status) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status, headers: { 'Retry-After': '120' } }));
    await expect(new ParcelsAppTracker({ fetcher, trawl: new TrawlClient('http://browser.test', fetcher) }).fetch(number))
      .rejects.toMatchObject({ status, retryAfterMs: 120_000 });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it.each([{ error: 'NO_DATA' }, { error: 'NO_TRACKER' }, { states: [] }])('leaves no-history replies inconclusive without browser retries: %j', async (payload) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(reply(payload));
    const error = await new ParcelsAppTracker({ fetcher, trawl: new TrawlClient('http://browser.test', fetcher) }).fetch(number).catch((error: unknown) => error);
    expect(carrierErrorKind(error)).toBe('indeterminate');
    expect(error).toBeInstanceOf(NoHistoryError);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it.each([{ correctId: 'OTHER123', ...announced }, { states: [{}] }, { states: [null] }, { states: Array(1001).fill({}) }, { uuid: 'unfinished' }])('rejects aliases, malformed and intermediate replies', async (payload) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(reply(payload));
    await expect(new ParcelsAppTracker({ fetcher }).fetch(number)).rejects.toThrow();
  });

  it('starts no retry and no browser lookup once the caller cancels', async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('connection reset'));
    const controller = new AbortController();
    const lookup = new ParcelsAppTracker({ fetcher, trawl: new TrawlClient('http://browser.test', fetcher) })
      .fetch(number, undefined, null, null, controller.signal);
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
    controller.abort(new Error('caller cancelled'));
    // The interrupted request is the failure; the chain and the facade answer with the caller's reason.
    await expect(lookup).rejects.toMatchObject({ name: 'UpstreamNetworkError' });
    expect(fetcher).toHaveBeenCalledOnce();
  });
});

describe('ParcelsApp slow lookup recovery', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    // The ESM promise timer retains Node's clock in this Vitest environment.
    vi.spyOn(timers, 'setTimeout').mockImplementation(<T>(ms = 1, value?: T) =>
      new Promise<T>((resolve) => { setTimeout(() => resolve(value as T), ms); }));
    // Node's native AbortSignal timer is not driven by fake timers. Keep its
    // abort behavior while exercising the real bounded HTTP client below.
    vi.spyOn(AbortSignal, 'timeout').mockImplementation((ms) => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(new DOMException('Timed out', 'TimeoutError')), ms);
      return controller.signal;
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function timedFetch(replies: { afterMs: number; payload?: unknown; failure?: Error }[]) {
    let attempt = 0;
    return vi.fn<typeof fetch>().mockImplementation((_url, init) => new Promise((resolve, reject) => {
      const reply = replies[attempt++]!;
      const signal = init!.signal!;
      const abort = () => { clearTimeout(timer); reject(signal.reason); };
      const timer = setTimeout(() => {
        signal.removeEventListener('abort', abort);
        if (reply.failure) reject(reply.failure);
        else resolve(Response.json(reply.payload));
      }, reply.afterMs);
      signal.addEventListener('abort', abort, { once: true });
    }));
  }

  it('lets a cold lookup finish after the old ten-second cutoff without another request', async () => {
    const fetcher = timedFetch([{ afterMs: 12_000, payload: announced }]);
    const lookup = new ParcelsAppTracker({ fetcher }).fetch(number);
    await vi.advanceTimersByTimeAsync(12_000);
    await expect(lookup).resolves.toMatchObject({ current_stage: 'registered' });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('retries a timed-out POST once after two seconds, preserving input and both attempt records', async () => {
    const steps: StepRecord[] = [], lookups: LookupRecord[] = [];
    const recorder: StepRecorder = { step: (r) => { steps.push(r); }, lookup: (r) => { lookups.push(r); } };
    const fetcher = timedFetch([{ afterMs: 40_000, payload: announced }, { afterMs: 100, payload: announced }]);
    const tracker = new ParcelsAppTracker({ fetcher, recorder, trawl: new TrawlClient('http://browser.test', fetcher) });
    const lookup = tracker.fetch(number, undefined, ' 01234 ');
    await vi.advanceTimersByTimeAsync(31_999);
    expect(fetcher).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(101);
    await expect(lookup).resolves.toMatchObject({ tracking_source: 'structured-web-response', current_stage: 'registered' });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([API, API]);
    expect(String(fetcher.mock.calls[1]![1]!.body)).toBe(String(fetcher.mock.calls[0]![1]!.body));
    expect(new URLSearchParams(String(fetcher.mock.calls[1]![1]!.body)).get('extra[zipcode]')).toBe('01234');
    expect(steps).toMatchObject([
      { step: 'direct', outcome: 'transport' }, { step: 'retry', outcome: 'ok', fallbackFrom: 'direct' },
    ]);
    expect(lookups).toMatchObject([{ finalStep: 'retry', attempts: 2, outcome: 'ok', durationMs: 32_100 }]);
  });

  it('stops after two network failures without starting the same lookup again in a browser', async () => {
    const fetcher = timedFetch([
      { afterMs: 10, failure: new TypeError('connection reset') },
      { afterMs: 10, failure: new TypeError('connection reset again') },
    ]);
    const failure = expect(new ParcelsAppTracker({ fetcher, trawl: new TrawlClient('http://browser.test', fetcher) }).fetch(number))
      .rejects.toMatchObject({ kind: 'transport' });
    await vi.advanceTimersByTimeAsync(2_020);
    await failure;
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('rejects an unverified alias returned by the retry', async () => {
    const fetcher = timedFetch([
      { afterMs: 10, failure: new TypeError('connection reset') },
      { afterMs: 10, payload: { ...announced, correctId: 'OTHER123' } },
    ]);
    const failure = expect(new ParcelsAppTracker({ fetcher }).fetch(number)).rejects.toThrow('unverified tracking alias');
    await vi.advanceTimersByTimeAsync(2_020);
    await failure;
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('does not retry when a shorter caller deadline cannot accommodate the backoff', async () => {
    const fetcher = timedFetch([{ afterMs: 40_000, payload: announced }]);
    const failure = expect(new ParcelsAppTracker({ fetcher }).fetch(number, 31_000)).rejects.toMatchObject({ kind: 'transport' });
    await vi.advanceTimersByTimeAsync(30_000);
    await failure;
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('aborts the second request at the original deadline, including its backoff time', async () => {
    const fetcher = timedFetch([{ afterMs: 40_000, payload: announced }, { afterMs: 40_000, payload: announced }]);
    const failure = expect(new ParcelsAppTracker({ fetcher }).fetch(number)).rejects.toMatchObject({ kind: 'transport' });
    await vi.advanceTimersByTimeAsync(45_000);
    await failure;
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls.every(([, init]) => init!.signal!.aborted)).toBe(true);
  });
});
