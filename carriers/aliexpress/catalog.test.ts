import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { recognitionAskedCarriers } from '../../core/catalog/recognition.js';
import { detectCarrierMatch, parseTrackingInput } from '../../core/detection/index.js';
import { createTracker } from '../../facade/index.js';

const number = 'DOFR0000000000001HD';
const delivered: unknown = JSON.parse(readFileSync(new URL('./fixtures/delivered-dofr.json', import.meta.url), 'utf8'));
const inTransit = JSON.parse(readFileSync(new URL('./fixtures/in-transit.json', import.meta.url), 'utf8')) as {
  module: Record<string, unknown>[];
};

describe('Cainiao DOFR detection', () => {
  it('normalizes the complete identifier and routes it to Cainiao without a manual selection', async () => {
    const printed = 'dofr 0000000000001 hd';
    expect(parseTrackingInput(printed)).toMatchObject({
      carrier: 'aliexpress', trackingNumber: printed, confidence: 'high',
    });
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(delivered), {
      headers: { 'Content-Type': 'application/json' },
    }));
    const answer = await createTracker({ fetcher, providers: [] }).track({ number: printed });
    expect(answer).toMatchObject({
      carrier: 'aliexpress', source: 'aliexpress', attempts: [{ source: 'aliexpress', kind: 'ok' }],
      result: { status: 'delivered', current_stage: 'delivered', destination_country_name: 'France' },
    });
    expect(answer.result.events.map(event => event.stage)).toEqual(['delivered', 'out_for_delivery', 'registered']);
    expect(answer.result.events[0]).toMatchObject({
      time: '2026-03-04T10:15:00+01:00', instant: '2026-03-04T10:15:00+01:00',
    });
    expect(new Date(answer.result.events[0]!.instant!).toISOString()).toBe('2026-03-04T09:15:00.000Z');
    expect(fetcher).toHaveBeenCalledOnce();
    const requested = new URL(String(fetcher.mock.calls[0]![0]));
    expect(requested.origin + requested.pathname).toBe('https://global.cainiao.com/global/detail.json');
    expect(requested.searchParams.get('mailNos')).toBe(number);
  });

  it('extracts the complete identifier from prose and links on unknown hosts', () => {
    expect(parseTrackingInput(`Tracking number: ${number}`)).toMatchObject({
      carrier: 'aliexpress', trackingNumber: number, confidence: 'high', source: 'text',
    });
    expect(parseTrackingInput(`https://example.com/parcel/${number}`)).toMatchObject({
      carrier: 'aliexpress', trackingNumber: number, confidence: 'high', source: 'link',
    });
    expect(parseTrackingInput(`Parcel reference: X${number}`).carrier).not.toBe('aliexpress');
  });

  it('routes the CNFR numbers of the same series to Cainiao', () => {
    expect(parseTrackingInput('cnfr 0000000000001 hd')).toMatchObject({ carrier: 'aliexpress', confidence: 'high' });
  });

  it.each(['DOFR000000000001HD', 'DOFR00000000000001HD', 'DOFR0000000000001HU', 'DOGB0000000000001HD',
    'CNFR000000000001HD', 'CNFR0000000000001HU'])(
    'leaves unsupported format %s unresolved', (value) => {
      expect(detectCarrierMatch(value).candidates).not.toContain('aliexpress');
    },
  );
});

describe('partner numbers Cainiao follows', () => {
  // AliExpress shows the buyer SDA's waybill while the parcel is still on Cainiao's leg.
  const waybill = '000D00000001F';

  function fetcherKnownTo(cainiao: boolean, poste = false) {
    return vi.fn<typeof fetch>((input) => Promise.resolve(new Response(JSON.stringify(
      String(input).startsWith('https://global.cainiao.com/')
        ? { ...inTransit, module: [cainiao ? { ...inTransit.module[0], mailNo: waybill, destCountry: 'Italy' }
          : { mailNo: waybill, mailNoSource: 'EXTERNAL', detailList: [] }] }
        : poste ? { idTracciatura: waybill, esitoRicerca: '3', tipoSpedizione: 'P', listaMovimenti: [{
          statoLavorazione: 'la spedizione è in transito presso il Centro di lavorazione Internazionale',
          dataOra: Date.now() - 3_600_000, luogo: 'Test Depot',
        }] }
          : { idTracciatura: waybill, esitoRicerca: '2', listaMovimenti: [] },
    ), { headers: { 'Content-Type': 'application/json' } })));
  }

  it('asks Cainiao beside Poste Italiane about an SDA waybill and files it under the one that knows it', async () => {
    expect(detectCarrierMatch(waybill)).toEqual({
      carrier: 'unknown', confidence: 'low', candidates: ['aliexpress', 'poste-italiane'], preferred: [],
    });
    expect(recognitionAskedCarriers(waybill)).toEqual(['poste-italiane', 'aliexpress']);
    const fetcher = fetcherKnownTo(true);
    const tracker = createTracker({ fetcher, providers: [] });
    await expect(tracker.recognize(waybill)).resolves.toMatchObject({
      carrier: 'aliexpress', choices: [], asked: ['poste-italiane', 'aliexpress'], unanswered: [],
    });
    await expect(tracker.track({ number: waybill })).resolves.toMatchObject({
      carrier: 'aliexpress', source: 'aliexpress', result: { status: 'in_transit' },
    });
  });

  it('files a waybill both know under AliExpress and proposes Poste Italiane as its delivery carrier', async () => {
    const tracker = createTracker({ fetcher: fetcherKnownTo(true, true), providers: [] });
    await expect(tracker.recognize(waybill)).resolves.toMatchObject({ carrier: 'aliexpress', choices: [] });
    await expect(tracker.track({ number: waybill })).resolves.toMatchObject({
      carrier: 'aliexpress', source: 'aliexpress', result: { destination_country_name: 'Italy' },
      handoff: { carrier: 'poste-italiane', number: waybill, basis: 'reference', confirmed: true, result: { status: 'in_transit' } },
    });
  });

  it('files a waybill only Poste Italiane knows under Poste Italiane', async () => {
    await expect(createTracker({ fetcher: fetcherKnownTo(false, true), providers: [] }).recognize(waybill))
      .resolves.toMatchObject({ carrier: 'poste-italiane', choices: [] });
  });

  it('leaves the waybill without a carrier when neither knows it', async () => {
    await expect(createTracker({ fetcher: fetcherKnownTo(false), providers: [] }).recognize(waybill)).resolves.toEqual({
      choices: [], asked: ['poste-italiane', 'aliexpress'], unanswered: [],
    });
  });

  it.each(['AP00000000000001', 'CNUSUP00000000001', 'CNBR00000000001', 'CNMEX0000000001', 'CACAINIAO00000000001',
    'RLV00000001', 'RLDW00000001', 'JNCN000000000001', 'ECSC00AARO00000001', 'PA0000000001', 'F00000000000001',
    '9C0000I000001'])('asks Cainiao about %s', (value) => {
    expect(detectCarrierMatch(value)).toMatchObject({ carrier: 'unknown', confidence: 'low', preferred: [] });
    expect(recognitionAskedCarriers(value)).toContain('aliexpress');
  });

  it.each(['AP0000000000001', 'CNES00000000001', 'RL00000001', 'PA1000000001', 'F10000000000001', '9C0000A000001'])(
    'does not suggest AliExpress for %s', (value) => {
      expect(detectCarrierMatch(value).candidates).not.toContain('aliexpress');
    },
  );
});
