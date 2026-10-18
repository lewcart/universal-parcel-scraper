import { describe, expect, it } from 'vitest';
import { recognitionAskedCarriers, recognitionCandidates } from '../catalog/recognition.js';
import { isCttExpressTrackingNumber } from './cttExpress.js';
import { checksumRejections, detectCarrierMatch } from './index.js';

describe('S10-shaped numbers', () => {
  it.each(['RR123456785TY', 'RR123456785MI', 'RR123456785YW', 'RR123456785CS', 'RR123456785EN'])(
    'leaves %s out of international mail: its suffix names no issuing country',
    (number) => {
      expect(detectCarrierMatch(number)).toMatchObject({ carrier: 'unknown', confidence: 'low' });
      expect(detectCarrierMatch(number).candidates).not.toContain('intl-post');
      expect(recognitionAskedCarriers(number)).not.toContain('intl-post');
      expect(checksumRejections(number)).toEqual([]);
    },
  );

  it('suggests AliExpress first for a TY number, a suffix Cainiao gives AliExpress parcels', () => {
    expect(detectCarrierMatch('rr 123 456 785 ty')).toEqual({
      carrier: 'unknown', confidence: 'low', candidates: ['aliexpress', 'chronopost'], preferred: ['aliexpress'],
    });
    expect(recognitionCandidates('RR123456785TY')).toEqual([
      { carrier: 'aliexpress', needsInput: null, preferred: true },
      { carrier: 'chronopost', needsInput: null, preferred: false },
    ]);
    expect(detectCarrierMatch('RR123456789TY').candidates).toEqual(['chronopost']);
    expect(checksumRejections('RR123456789TY')).toEqual([{ carrier: 'aliexpress', rule: 'aliexpress-ty', checksum: 's10' }]);
  });

  it('suggests AliExpress first for an MI number, a suffix Cainiao gives an AliExpress parcel', () => {
    expect(detectCarrierMatch('rr 123 456 785 mi')).toEqual({
      carrier: 'unknown', confidence: 'low', candidates: ['aliexpress', 'chronopost'], preferred: ['aliexpress'],
    });
    expect(recognitionCandidates('RR123456785MI')).toEqual([
      { carrier: 'aliexpress', needsInput: null, preferred: true },
      { carrier: 'chronopost', needsInput: null, preferred: false },
    ]);
    expect(detectCarrierMatch('RR123456789MI').candidates).toEqual(['chronopost']);
    expect(checksumRejections('RR123456789MI')).toEqual([{ carrier: 'aliexpress', rule: 'aliexpress-mi', checksum: 's10' }]);
  });

  it('keeps a country suffix with no dedicated post in international mail', () => {
    expect(detectCarrierMatch('RR123456785EE')).toMatchObject({ carrier: 'intl-post', confidence: 'high' });
  });

  it('names DHL for Deutsche Post registered letters whose check digit holds', () => {
    for (const number of ['RR123456785DE', 'rk 123 456 785 de']) {
      expect(detectCarrierMatch(number)).toMatchObject({ carrier: 'dhl', confidence: 'high', candidates: ['dhl'] });
    }
    expect(detectCarrierMatch('RR123456789DE').candidates).not.toContain('dhl');
    expect(detectCarrierMatch('RR123456789DE').candidates).not.toContain('intl-post');
    expect(checksumRejections('RR123456789DE')).toEqual([{ carrier: 'dhl', rule: 'dhl-14', checksum: 's10' }]);
    // Other German-issued services stay international mail.
    expect(detectCarrierMatch('EE123456785DE')).toMatchObject({ carrier: 'intl-post', confidence: 'high' });
  });

  it('asks Poczta Polska first about a Polish-issued number without selecting it', () => {
    expect(detectCarrierMatch('cp 123 456 785 pl')).toMatchObject({ carrier: 'intl-post', confidence: 'high' });
    expect(recognitionCandidates('cp 123 456 785 pl')).toEqual([
      { carrier: 'poczta-polska', needsInput: null, preferred: true },
      { carrier: 'chronopost', needsInput: null, preferred: false },
    ]);
    expect(recognitionAskedCarriers('CP123456789PL')).not.toContain('poczta-polska');
  });

  it('asks Australia Post and Ukrposhta first about the numbers they issue without selecting them', () => {
    expect(detectCarrierMatch('rr 123 456 785 au')).toMatchObject({ carrier: 'intl-post', confidence: 'high' });
    expect(recognitionCandidates('rr 123 456 785 au')).toEqual([
      { carrier: 'australia-post', needsInput: null, preferred: true },
      { carrier: 'chronopost', needsInput: null, preferred: false },
    ]);
    expect(recognitionAskedCarriers('RR123456789AU')).not.toContain('australia-post');
    expect(detectCarrierMatch('RR123456785UA')).toMatchObject({ carrier: 'intl-post', confidence: 'high' });
    expect(recognitionCandidates('RR123456785UA')).toEqual([
      { carrier: 'ukrposhta', needsInput: null, preferred: true },
      { carrier: 'chronopost', needsInput: null, preferred: false },
    ]);
    expect(recognitionAskedCarriers('RR123456789UA')).not.toContain('ukrposhta');
  });

  it('offers USPS a US-issued number in the browser phase only', () => {
    expect(detectCarrierMatch('EC123456785US')).toMatchObject({ carrier: 'intl-post', confidence: 'high' });
    expect(recognitionAskedCarriers('EC123456785US')).not.toContain('usps');
    expect(recognitionCandidates('EC123456785US', { phase: 'browser' })).toEqual([
      { carrier: 'usps', needsInput: null, preferred: true },
    ]);
    expect(recognitionCandidates('EC123456789US', { phase: 'browser' })).toEqual([]);
    // Asendia USA's own numbers keep their carrier.
    expect(detectCarrierMatch('AS123456785US')).toMatchObject({ carrier: 'asendia', confidence: 'high' });
    expect(recognitionCandidates('AS123456785US', { phase: 'browser' })).toEqual([]);
  });
});

describe('Korea Post domestic numbers', () => {
  it('suggests Korea Post for thirteen digits that start with 1 to 6', () => {
    for (const number of ['1000000000001', '3000000000001', '5000000000001', '6000000000001']) {
      expect(detectCarrierMatch(number)).toMatchObject({ carrier: 'unknown', confidence: 'low' });
      expect(detectCarrierMatch(number).candidates).toContain('korea-post');
    }
    for (const number of ['0000000000001', '7000000000001', '100000000001', '10000000000001']) {
      expect(detectCarrierMatch(number).candidates).not.toContain('korea-post');
    }
  });
});

describe('Magyar Posta numbers', () => {
  it('suggests Magyar Posta first for a domestic number whose check digit holds', () => {
    expect(detectCarrierMatch('pn zzz 0000 0013')).toEqual({
      carrier: 'unknown', confidence: 'low', candidates: ['magyar-posta'], preferred: ['magyar-posta'],
    });
    expect(detectCarrierMatch('PNZZZ00000014')).toMatchObject({ confidence: 'none', candidates: [] });
    expect(checksumRejections('PNZZZ00000014')).toEqual([{ carrier: 'magyar-posta', rule: 'magyar-posta-domestic', checksum: 'magyar-posta' }]);
    // A numeric customer code also fits La Poste's two-characters-and-eleven-digits rule.
    expect(detectCarrierMatch('PB00000000013').candidates).toEqual(['magyar-posta', 'la-poste']);
    expect(detectCarrierMatch('PB00000000014').candidates).toEqual(['la-poste']);
  });

  it('keeps a Hungarian S10 number in international mail and never asks Magyar Posta, whose tracker needs a solved checkbox', () => {
    expect(detectCarrierMatch('RR123456785HU')).toMatchObject({ carrier: 'intl-post', confidence: 'high' });
    for (const number of ['RR123456785HU', 'PNZZZ00000013', 'PB00000000013']) {
      expect(recognitionAskedCarriers(number)).not.toContain('magyar-posta');
      expect(recognitionCandidates(number, { phase: 'browser' })).toEqual([]);
    }
    expect(checksumRejections('RR123456789HU')).toContainEqual({ carrier: 'magyar-posta', rule: 'magyar-posta-s10', checksum: 's10' });
  });
});

describe('Poste Italiane registered mail', () => {
  it('suggests Poste Italiane for twelve digits whose check digit holds, typed with or without the dash', () => {
    for (const number of ['990000000010', '99000000001-0', '99000000001 0']) {
      expect(detectCarrierMatch(number)).toMatchObject({ carrier: 'unknown', confidence: 'low' });
      expect(detectCarrierMatch(number).candidates).toContain('poste-italiane');
      expect(checksumRejections(number).map(({ carrier }) => carrier)).not.toContain('poste-italiane');
    }
    // The check is the digit sum of the weighted total, 109 here, not the total itself.
    expect(detectCarrierMatch('990000001000').candidates).toContain('poste-italiane');
  });

  it('leaves out other lengths and a failed check digit', () => {
    for (const number of ['99000000001', '9900000000100', '990000000011', '990000001009']) {
      expect(detectCarrierMatch(number).candidates).not.toContain('poste-italiane');
      expect(recognitionAskedCarriers(number, { countryHint: 'IT' })).not.toContain('poste-italiane');
    }
    expect(checksumRejections('990000001009')).toContainEqual({
      carrier: 'poste-italiane', rule: 'poste-italiane-registered', checksum: 'poste-italiane',
    });
  });

  it('keeps a valid FedEx number first and asks Poste Italiane before the unchecked twelve-digit carriers', () => {
    expect(detectCarrierMatch('990000001000')).toMatchObject({ preferred: ['fedex'] });
    expect(detectCarrierMatch('990000001000').candidates[0]).toBe('fedex');
    const asked = recognitionAskedCarriers('200000000013');
    expect(asked).toContain('poste-italiane');
    expect(asked.indexOf('poste-italiane')).toBeLessThan(asked.indexOf('brt'));
    expect(recognitionAskedCarriers('200000000013', { countryHint: 'IT' })[0]).toBe('poste-italiane');
  });
});

describe('Nordic SSCCs behind the 00 identifier', () => {
  it.each(['00357123456789012348', '00073123456789012347', '00573123456789012342'])(
    'lists PostNord first for %s, a Danish or Swedish GS1 prefix',
    (number) => {
      expect(detectCarrierMatch(number)).toMatchObject({ carrier: 'unknown', confidence: 'low' });
      expect(detectCarrierMatch(number).candidates[0]).toBe('postnord');
    },
  );

  it('keeps PostNord out when the SSCC check digit fails', () => {
    expect(detectCarrierMatch('00357123456789012349').candidates).not.toContain('postnord');
    expect(checksumRejections('00357123456789012349')).toEqual(expect.arrayContaining([
      { carrier: 'postnord', rule: 'postnord-5', checksum: 'sscc' },
      { carrier: 'postnord', rule: 'postnord-3', checksum: 'sscc' },
    ]));
  });

  it.each(['00370123456789012347', '00373123456789012348'])('keeps Bring first for its parcel SSCC %s', (number) => {
    const { candidates } = detectCarrierMatch(number);
    expect(candidates[0]).toBe('bring-posten');
    expect(candidates).toContain('postnord');
  });

  it('lists and asks Posti first for a Finnish GS1 prefix', () => {
    expect(detectCarrierMatch('00264123456789012349')).toMatchObject({ carrier: 'unknown', confidence: 'low' });
    expect(detectCarrierMatch('00264123456789012349').candidates[0]).toBe('posti');
    expect(recognitionAskedCarriers('00264123456789012349')[0]).toBe('posti');
    for (const number of ['00264123456789012340', '00265123456789012346']) {
      expect(detectCarrierMatch(number).candidates).not.toContain('posti');
    }
  });
});

describe('Australia Post barcodes', () => {
  it('keeps CTT Express to references whose two agency codes start with 00', () => {
    expect(isCttExpressTrackingNumber('0001001234567812340995')).toBe(false);
    expect(detectCarrierMatch('0001001234567812340995').candidates).not.toContain('ctt-express');
    expect(detectCarrierMatch('0082800082801234567890')).toMatchObject({ carrier: 'ctt-express', confidence: 'high' });
    expect(detectCarrierMatch('0082800082801234567890001')).toMatchObject({ carrier: 'ctt-express', confidence: 'high' });
  });

  it.each(['33ABC123456701000935106', 'XY1234567801000935107'])('selects Australia Post for the article ID %s', (number) => {
    expect(detectCarrierMatch(number)).toMatchObject({ carrier: 'australia-post', confidence: 'high' });
  });

  it('selects Australia Post for an all-digit article ID that also passes the GS1 check', () => {
    expect(detectCarrierMatch('99722123456701000830900')).toMatchObject({ carrier: 'australia-post', confidence: 'high' });
    expect(detectCarrierMatch('90000000000000123000001')).toMatchObject({ carrier: 'unknown', candidates: ['correos-express'] });
  });

  it('suggests Australia Post first for a twelve-character consignment number whose location ID has a letter', () => {
    expect(detectCarrierMatch('33ABC1234567')).toEqual({
      carrier: 'unknown', confidence: 'low', candidates: ['australia-post', 'colis-prive'], preferred: ['australia-post'],
    });
    expect(recognitionAskedCarriers('33ABC1234567')).toEqual(['australia-post', 'colis-prive']);
    expect(detectCarrierMatch('343AY1234567').candidates).toContain('australia-post');
    expect(detectCarrierMatch('331231234567').candidates).not.toContain('australia-post');
  });

  it.each(['2AB1234567', 'A2B1234567', 'ABC1234567', '12A1234567', 'A121234567'])(
    'suggests Australia Post alone for the ten-character consignment number %s',
    (number) => {
      expect(detectCarrierMatch(number)).toMatchObject({ carrier: 'unknown', confidence: 'low', candidates: ['australia-post'] });
    },
  );

  it.each(['AB12345678', '1231234567'])('leaves the ten-character number %s to the carriers that share its shape', (number) => {
    expect(detectCarrierMatch(number).candidates).not.toContain('australia-post');
  });

  it('suggests Australia Post for a 22-digit prepaid barcode only when its GS1 check passes', () => {
    expect(detectCarrierMatch('0208061234567890123456')).toMatchObject({ carrier: 'unknown', confidence: 'low' });
    expect(detectCarrierMatch('0208061234567890123456').candidates).toContain('australia-post');
    expect(recognitionAskedCarriers('0208061234567890123456')[0]).toBe('australia-post');
    expect(detectCarrierMatch('0208061234567890123457').candidates).not.toContain('australia-post');
    expect(checksumRejections('0208061234567890123457')).toEqual([
      { carrier: 'australia-post', rule: 'australia-post-prepaid', checksum: 'gs1' },
    ]);
    expect(detectCarrierMatch('0408061234567890123454').candidates).not.toContain('australia-post');
  });
});
