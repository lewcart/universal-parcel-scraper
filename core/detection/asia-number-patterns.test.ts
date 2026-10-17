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

  it('asks Huiyi Logistics about its lettered numbers without naming it from the shape', () => {
    expect(detectCarrierMatch('ABCD00D0000EFGH')).toMatchObject({ carrier: 'unknown', confidence: 'low', candidates: ['hywl'] });
    expect(recognitionAskedCarriers('ABCD00D0000EFGH')).toEqual(['hywl']);
    for (const number of ['ABCD00E0000EFGH', 'ABCD00D0000EFG', 'ABC00D0000EFGH', 'ABCD000D0000EFGH', 'ABCD00D00000EFGH']) {
      expect(detectCarrierMatch(number).candidates ?? [], number).not.toContain('hywl');
    }
  });

  it('asks DHLink about its line provider\'s XZG tracking numbers without naming it from the shape', () => {
    expect(detectCarrierMatch('XZG000000001WL')).toMatchObject({ carrier: 'unknown', confidence: 'low', candidates: ['dhlink'] });
    expect(recognitionAskedCarriers('XZG000000001WL')).toEqual(['dhlink']);
    for (const number of ['XZG00000001WL', 'XZG0000000001WL', 'XZG000000001WX', 'XZH000000001WL', 'YIL000000001WL']) {
      expect(detectCarrierMatch(number).candidates ?? [], number).not.toContain('dhlink');
    }
  });
});

describe('wave seven South-East Asian courier rules', () => {
  // Synthetic numbers in each carrier's layout; none is a real parcel.
  it('names SPX Express Singapore for SPXSG numbers and only suggests it for SLS numbers', () => {
    for (const number of ['SPXSG000000000011', 'SPXSG00000000001A']) {
      expect(detectCarrierMatch(number), number).toMatchObject({ carrier: 'spx-sg', confidence: 'high' });
    }
    expect(detectCarrierMatch('SG0000000000011')).toMatchObject({ carrier: 'unknown', confidence: 'low', candidates: ['spx-sg'] });
    for (const number of ['SPXSG0000000001', 'SPXSG0000000000001', 'SG000000000001', 'SG00000000000011']) {
      expect(detectCarrierMatch(number).candidates ?? [], number).not.toContain('spx-sg');
    }
  });

  it('names GoTo Logistics for TKGTL numbers, with or without the hyphen', () => {
    for (const number of ['TKGTL-0000000000A', 'TKGTL0000000000A']) {
      expect(detectCarrierMatch(number), number).toMatchObject({ carrier: 'gtl-goto', confidence: 'high', candidates: ['gtl-goto'] });
    }
    for (const number of ['TKGTL000000000A', 'TKGTL00000000000A', 'TKGTM0000000000A']) {
      expect(detectCarrierMatch(number).candidates ?? [], number).not.toContain('gtl-goto');
    }
  });

  it('names Paxel for its dated AWB, written with or without separators', () => {
    for (const number of ['EM.000000000A-20260101-0-00000A', 'EM000000000A20260101000000A']) {
      expect(detectCarrierMatch(number), number).toMatchObject({ carrier: 'paxel', confidence: 'high', candidates: ['paxel'] });
    }
    for (const number of ['EM000000000A19260101000000A', 'EM00000000A20260101000000A', 'EN000000000A20260101000000A']) {
      expect(detectCarrierMatch(number).candidates ?? [], number).not.toContain('paxel');
    }
  });

  it('keeps IDexpress for its ID waybills and leaves SGX IDA air waybills unnamed', () => {
    for (const number of ['IDS000000000001', 'IDE0000000000001', 'IDA0000000000001']) {
      expect(detectCarrierMatch(number), number).toMatchObject({ carrier: 'idexpress', confidence: 'high' });
    }
    expect(detectCarrierMatch('IDA000000000001').candidates ?? []).not.toContain('idexpress');
  });

  it('names the Pickupp network its region suffix shows', () => {
    expect(detectCarrierMatch('PU000000000001HK')).toMatchObject({ carrier: 'pickupp', confidence: 'high', candidates: ['pickupp'] });
    expect(detectCarrierMatch('PU000000000001SG')).toMatchObject({ carrier: 'pickupp-sg', confidence: 'high', candidates: ['pickupp-sg'] });
    for (const number of ['PU000000000001MY', 'PU00000000001HK', 'PU0000000000001SG']) {
      const candidates = detectCarrierMatch(number).candidates ?? [];
      expect(candidates, number).not.toContain('pickupp');
      expect(candidates, number).not.toContain('pickupp-sg');
    }
  });
});
