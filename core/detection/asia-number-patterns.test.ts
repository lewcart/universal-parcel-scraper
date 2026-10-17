import { describe, expect, it } from 'vitest';
import { recognitionAskedCarriers, recognitionCandidates } from '../catalog/recognition.js';
import { checksumRejections, detectCarrierMatch, parseTrackingInput } from './index.js';

describe('prefixed Asian shipment references and shared numeric formats', () => {
  it('selects the documented SF waybill family without widening bare numeric attribution', () => {
    expect(detectCarrierMatch('sf 000 000 000 0000')).toMatchObject({ carrier: 'sf-express', confidence: 'high' });
    expect(parseTrackingInput('Tracking number: SF0000000000000')).toMatchObject({
      trackingNumber: 'SF0000000000000', carrier: 'sf-express', confidence: 'high',
    });
    expect(detectCarrierMatch('SF0000000000001')).toMatchObject({ carrier: 'unknown', confidence: 'low', candidates: ['sf-express'] });
    expect(detectCarrierMatch('000000000001')).toMatchObject({ carrier: 'unknown', confidence: 'low' });
    for (const number of ['SF000000000001', 'SF00000000000001', 'XSF0000000000001', 'SF0000000000001CN']) {
      expect(detectCarrierMatch(number).candidates).not.toContain('sf-express');
    }
  });

  it('selects JD Logistics for its prefixed domestic waybills at their own length only', () => {
    for (const number of ['JD0000000000000', 'JDV000000000000', 'JDVA00000000000', 'jdx 000000000000']) {
      expect(detectCarrierMatch(number)).toMatchObject({ carrier: 'jd-logistics', confidence: 'high' });
    }
    for (const number of ['JD000000000000', 'JD00000000000000', 'JDVAB0000000000', 'XJD0000000000000']) {
      expect(detectCarrierMatch(number).candidates).not.toContain('jd-logistics');
    }
  });

  it.each([
    ['LP00000000000001', 'aliexpress'],
    ['LP0000000000001CN', 'four-px'],
    ['0000000000001', 'delhivery'],
    ['00000000000001', 'delhivery'],
  ])('keeps %s ambiguous while allowing its direct HTTP confirmation', (number, carrier) => {
    expect(detectCarrierMatch(number)).toMatchObject({ carrier: 'unknown', confidence: 'low' });
    expect(detectCarrierMatch(number).candidates).toContain(carrier);
    expect(recognitionCandidates(number).map(candidate => candidate.carrier)).toContain(carrier);
  });

  it('anchors the two LP reference families independently of postal suffixes', () => {
    for (const number of ['LP0000000000001', 'XLP00000000000001', 'LP00000000000001CN']) {
      expect(detectCarrierMatch(number).candidates).not.toContain('aliexpress');
    }
    for (const number of ['LP000000000001CN', 'LP00000000000001CN', 'LP0000000000001SG']) {
      expect(detectCarrierMatch(number).candidates).not.toContain('four-px');
    }
  });

  it('includes the LP and thirteen-digit Delhivery candidates within bounded HTTP preflight', () => {
    expect(recognitionAskedCarriers('LP00000000000001')).toContain('aliexpress');
    expect(recognitionAskedCarriers('LP0000000000001CN')).toContain('four-px');
    expect(recognitionAskedCarriers('2820000000001')).toContain('delhivery');
  });

  it('ranks a carrier whose check digit passes ahead of popularity alone', () => {
    // Synthetic twelve digits; only the first passes Purolator's Luhn check.
    expect(recognitionCandidates('300000000004')[0]!.carrier).toBe('purolator');
    expect(recognitionCandidates('300000000005').map(candidate => candidate.carrier)).not.toContain('purolator');
  });

  it('selects OnTrac only in its own C and D ranges while preserving LaserShip detection', () => {
    for (const number of ['C10000000000004', 'C17000000000007', 'D10000000000003']) {
      expect(detectCarrierMatch(number)).toMatchObject({ carrier: 'ontrac', confidence: 'high', candidates: ['ontrac'] });
      expect(recognitionCandidates(number)).toEqual([]);
    }
    for (const number of ['C00000000000006', 'C25000000000007', 'D00000000000005', 'D11000000000002']) {
      expect(detectCarrierMatch(number)).toMatchObject({ carrier: 'unknown', confidence: 'low', candidates: ['ontrac'] });
      expect(recognitionCandidates(number).map(candidate => candidate.carrier)).toContain('ontrac');
    }
    for (const number of ['C10000000000001', 'C00000000000001']) expect(detectCarrierMatch(number).candidates).not.toContain('ontrac');
    expect(detectCarrierMatch('1LS0000000000001')).toMatchObject({ carrier: 'ontrac', confidence: 'high' });
  });

  it('keeps other national SPX networks outside the Philippines adapter', () => {
    for (const number of ['SPXID000000000001', 'SPXMY00000000001C']) {
      expect(detectCarrierMatch(number).carrier).not.toBe('spx-ph');
      expect(detectCarrierMatch(number).candidates).not.toContain('spx-ph');
    }
  });

  it('selects Pos Laju consignments only when their S10 check digit holds', () => {
    // The ninth digit checks the eight before it; the third letter is outside the check.
    for (const number of ['EHE000000005MY', 'ERA123456785MY', 'XYZ000000080MY', 'ehe 000000005 my']) {
      expect(detectCarrierMatch(number)).toMatchObject({ carrier: 'pos-malaysia', confidence: 'high' });
    }
    for (const number of ['EHE000000006MY', 'ERA123456780MY', 'XYZ000000085MY']) {
      expect(detectCarrierMatch(number).candidates).not.toContain('pos-malaysia');
      expect(checksumRejections(number)).toEqual([{ carrier: 'pos-malaysia', rule: 'pos-malaysia-4', checksum: 'pos-laju' }]);
    }
  });

  it('suggests China Post before La Poste for ZS and ZC numbers only', () => {
    for (const number of ['ZS00000000001', 'ZC00000000001']) {
      expect(detectCarrierMatch(number)).toMatchObject({ carrier: 'unknown', confidence: 'low', candidates: ['china-post', 'la-poste'] });
      expect(recognitionAskedCarriers(number)[0]).toBe('china-post');
    }
    // Other Z prefixes and other lengths keep La Poste's broad rule alone, or nothing.
    for (const number of ['ZT00000000001', 'ZA00000000001', 'CZ00000000001']) {
      expect(detectCarrierMatch(number).candidates).toEqual(['la-poste']);
    }
    for (const number of ['ZC0000000001', 'ZC000000000001', 'ZC00000000001CN']) {
      expect(detectCarrierMatch(number).candidates ?? []).not.toContain('china-post');
    }
  });

  it('gives each forwarder\'s YQ code to the carrier of its prefix alone', () => {
    // Forwarders on one Chinese platform share the YQ ending and ten digits; the customer prefix names the forwarder.
    const owners = { JSEJY0000000001YQ: 'js-express', WNBZZ0000000001YQ: 'wanbexpress', FEISH0000000001YQ: '17feia',
      SFCAA0000000001YQ: 'sfc', CJPZZA0000000001YQ: 'cj-packet', BUFZA0000000001YQ: 'buffalo-ex' };
    for (const [number, carrier] of Object.entries(owners)) {
      expect(detectCarrierMatch(number), number).toMatchObject({ carrier, confidence: 'high', candidates: [carrier] });
      expect(recognitionCandidates(number), number).toEqual([]);
    }
    // JS Express and WanbExpress never stand in for each other.
    expect(detectCarrierMatch('JSEZZ0000000001YQ').candidates).not.toContain('wanbexpress');
    expect(detectCarrierMatch('WNBJS0000000001YQ').candidates).not.toContain('js-express');
    // A prefix no catalog forwarder uses, or a code a digit short, is left to the user.
    for (const number of ['ABCDE0000000001YQ', 'JSEJY000000001YQ', 'WNBZZ000000001YQ', 'JSWNB0000000001YQ']) {
      expect(detectCarrierMatch(number), number).toMatchObject({ carrier: 'unknown', candidates: [] });
    }
    expect(detectCarrierMatch('YL0000000001YQ')).toMatchObject({ carrier: 'unknown', confidence: 'low', candidates: ['gzyl'] });
  });

  it('asks DHLink about its line provider\'s XZG tracking numbers without naming it from the shape', () => {
    expect(detectCarrierMatch('XZG000000001WL')).toMatchObject({ carrier: 'unknown', confidence: 'low', candidates: ['dhlink'] });
    expect(recognitionAskedCarriers('XZG000000001WL')).toEqual(['dhlink']);
    for (const number of ['XZG00000001WL', 'XZG0000000001WL', 'XZG000000001WX', 'XZH000000001WL', 'YIL000000001WL']) {
      expect(detectCarrierMatch(number).candidates ?? [], number).not.toContain('dhlink');
    }
  });
});
