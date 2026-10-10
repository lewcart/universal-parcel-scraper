import { describe, expect, it } from 'vitest';
import { recognitionCandidates, recognitionAskedCarriers } from '../catalog/recognition.js';
import { detectCarrierMatch, parseTrackingInput } from './index.js';
import { isPosteItalianeTrackingNumber } from './posteItaliane.js';

describe('continental shipment candidates', () => {
  it('offers BRT shipment numbers without assigning ownership from twelve digits', () => {
    const number = '990000000001';
    expect(detectCarrierMatch(number)).toMatchObject({ carrier: 'unknown', confidence: 'low', candidates: expect.arrayContaining(['brt']) });
    expect(recognitionCandidates(number)).toEqual(expect.arrayContaining([expect.objectContaining({ carrier: 'brt' })]));
    expect(parseTrackingInput(`Tracking number: ${number}`)).toMatchObject({ trackingNumber: number, carrier: 'unknown', confidence: 'low' });
  });

  it('prioritizes documented bpost prefixes while preserving overlapping numeric candidates', () => {
    for (const number of ['323200000000000001', '323200000000000000000001', '329900000000000000000001']) {
      const detected = detectCarrierMatch(number);
      expect(detected).toMatchObject({ carrier: 'unknown', confidence: 'low', preferred: ['bpost'] });
      expect(detected.candidates[0]).toBe('bpost');
      expect(recognitionAskedCarriers(number)[0]).toBe('bpost');
      expect(detected.candidates.length).toBeGreaterThan(1);
    }
    for (const number of ['600000000000000000000001', '32320000000000001', '3232000000000000000000001']) {
      expect(detectCarrierMatch(number).preferred).not.toContain('bpost');
    }
  });

  it('lists Bring first for its GS1-checked parcel and consignment numbers and reads its tracking links', () => {
    for (const number of ['370000000000000004', '373000000000000005', '00370000000000000004', '70000000000000003']) {
      const detected = detectCarrierMatch(number);
      expect(detected).toMatchObject({ carrier: 'unknown', confidence: 'low', preferred: ['bring-posten'] });
      expect(detected.candidates.length).toBeGreaterThan(1);
    }
    for (const number of ['370000000000000005', '371000000000000001', '70000000000000004', '71000000000000000']) {
      expect(detectCarrierMatch(number).candidates).not.toContain('bring-posten');
    }
    expect(parseTrackingInput('https://tracking.bring.se/tracking/70000000000000003?packageNumber=370000000000000004&lang=en'))
      .toMatchObject({ trackingNumber: '370000000000000004', carrier: 'bring-posten', source: 'link' });
    expect(parseTrackingInput('https://tracking.bring.dk/tracking/00370000000000000004'))
      .toMatchObject({ trackingNumber: '00370000000000000004', carrier: 'bring-posten', source: 'link' });
    expect(parseTrackingInput('https://sporing.posten.no/sporing/70000000000000003'))
      .toMatchObject({ trackingNumber: '70000000000000003', carrier: 'bring-posten', source: 'link' });
  });

  it('sends whole SDA candidates through Poste recognition and rejects truncated families', () => {
    for (const number of ['990001A000001', '3C9900A000001', '990A00000001A']) {
      expect(isPosteItalianeTrackingNumber(number)).toBe(true);
      expect(detectCarrierMatch(number)).toMatchObject({ carrier: 'unknown', confidence: 'low', candidates: ['poste-italiane'] });
      expect(recognitionAskedCarriers(number)).toEqual(['poste-italiane']);
      expect(parseTrackingInput(`Tracking number: ${number}`)).toMatchObject({ trackingNumber: number, carrier: 'unknown', candidates: ['poste-italiane'] });
      expect(isPosteItalianeTrackingNumber(number.slice(1))).toBe(false);
    }
    expect(isPosteItalianeTrackingNumber('ABCDEF0000001')).toBe(false);
  });

  it('retains the historical PostNL id for its complete 3S barcode', () => {
    expect(detectCarrierMatch('3SZZZZ1000001')).toMatchObject({ carrier: 'spring-gds', confidence: 'high' });
    expect(recognitionAskedCarriers('3SZZZZ1000001')).toEqual([]);
  });

  it('splits 3S barcodes between PostNL and DHL Parcel by the customer code', () => {
    for (const postnl of ['3SZZZZ1000001', '3SZZZZ100000001']) {
      expect(detectCarrierMatch(postnl)).toMatchObject({ carrier: 'spring-gds', confidence: 'high' });
    }
    for (const dhl of ['3SZZZ10000001', '3SZZZ100000001', '3SZZZ1000000001']) {
      expect(detectCarrierMatch(dhl)).toMatchObject({ carrier: 'dhl-ecommerce-nl', confidence: 'high' });
    }
    // PostNL's documentation also shows shorter customer codes; DHL prints two-letter ones.
    const shared = detectCarrierMatch('3SZZ10000000001');
    expect(shared).toMatchObject({ carrier: 'unknown', confidence: 'low' });
    expect([...shared.candidates].sort()).toEqual(['dhl-ecommerce-nl', 'spring-gds']);
    expect(recognitionAskedCarriers('3SZZ10000000001')).toEqual(['dhl-ecommerce-nl']);
    expect(detectCarrierMatch('3SZ1000000001')).toMatchObject({ carrier: 'unknown', confidence: 'low', candidates: ['spring-gds'] });
    expect(detectCarrierMatch('3SZZZ100000000001')).toMatchObject({ carrier: 'unknown', confidence: 'low', candidates: ['dhl-ecommerce-nl'] });
    for (const neither of ['3SZZZZ10000001', '3SZZZZZ10000001', '3S1000000000001']) {
      expect(detectCarrierMatch(neither).candidates).toEqual([]);
    }
  });
});

describe('DHL piece identifiers', () => {
  // Synthetic identifiers in the JD01 range Express labels print as "(J)JD".
  it('gives an Express piece identifier to DHL Express, however the label is typed', () => {
    for (const input of ['JD014600012345678901', 'jd0146 0001 2345 6789 01', '(J)JD014600012345678901', 'JJD014600012345678901',
      'https://www.dhl.com/de-de/home/tracking.html?submit=1&tracking-id=JD014600012345678901']) {
      expect(parseTrackingInput(input)).toMatchObject({ carrier: 'dhl-express', confidence: 'high', candidates: ['dhl-express'] });
    }
  });

  it('offers DHL for a DHL Paket plate typed without its J, and keeps other JJD numbers with DHL', () => {
    for (const plate of ['JD149000012345678901', 'JD000390012345678901']) {
      expect(detectCarrierMatch(plate)).toMatchObject({ carrier: 'unknown', confidence: 'low', candidates: ['dhl'] });
    }
    expect(detectCarrierMatch('JD0146000123456789012')).toMatchObject({ carrier: 'unknown', confidence: 'none' });
    // Only the 0146 range is seen with its J. DHL Paket's plates, and JD01 ranges not seen with their J, stay with DHL.
    for (const number of ['JJD000390012345678901', 'JJD149150012345678901', 'JJD012959123456789012', 'JJD01460001234567890123']) {
      expect(detectCarrierMatch(number)).toMatchObject({ carrier: 'dhl', confidence: 'high' });
    }
  });
});
