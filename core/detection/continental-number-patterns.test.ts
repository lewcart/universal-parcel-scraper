import { describe, expect, it } from 'vitest';
import { recognitionCandidates, recognitionAskedCarriers } from '../catalog/recognition.js';
import { detectCarrierMatch, parseTrackingInput } from './index.js';
import { isBrtTrackingNumber } from './brt.js';
import { isPosteItalianeTrackingNumber } from './posteItaliane.js';

describe('continental shipment candidates', () => {
  it('offers BRT shipment numbers without assigning ownership from twelve digits', () => {
    const number = '990000000001';
    expect(detectCarrierMatch(number)).toMatchObject({ carrier: 'unknown', confidence: 'low', candidates: expect.arrayContaining(['brt']) });
    expect(recognitionCandidates(number)).toEqual(expect.arrayContaining([expect.objectContaining({ carrier: 'brt' })]));
    expect(parseTrackingInput(`Tracking number: ${number}`)).toMatchObject({ trackingNumber: number, carrier: 'unknown', confidence: 'low' });
  });

  it("offers SEUR a sender's reference dated day before month, beside APC Overnight's barcode dated month first", () => {
    // Synthetic: 15 October 2026 reads only day first; 10 December or 12 October reads both ways.
    expect(detectCarrierMatch('2026151000000000000001')).toMatchObject({ carrier: 'unknown', confidence: 'low', preferred: [] });
    expect(detectCarrierMatch('2026151000000000000001').candidates).toContain('seur');
    expect(detectCarrierMatch('2026151000000000000001').candidates).not.toContain('apc-overnight');
    expect(recognitionAskedCarriers('2026151000000000000001')).toContain('seur');
    expect(detectCarrierMatch('2026101200000000000001')).toMatchObject({ confidence: 'low', preferred: ['apc-overnight'] });
    expect(detectCarrierMatch('2026101200000000000001').candidates).toEqual(expect.arrayContaining(['apc-overnight', 'seur']));
    for (const number of ['2026131300000000000001', '1926151000000000000001', '202615100000000000001']) {
      expect(detectCarrierMatch(number).candidates ?? []).not.toContain('seur');
    }
  });

  it('asks BRT about EOB customer parcel IDs without naming BRT from the shape', () => {
    expect(isBrtTrackingNumber('EOB99099100000000015')).toBe(true);
    expect(detectCarrierMatch('EOB99099100000000015')).toMatchObject({ carrier: 'unknown', confidence: 'low', candidates: ['brt'], preferred: [] });
    expect(recognitionAskedCarriers('EOB99099100000000015')).toEqual(['brt']);
    for (const number of ['EOB9909910000000001', 'EOB990991000000000150', 'EOC99099100000000015', 'XEOB99099100000000015', 'EOB9909910000000001A']) {
      expect(isBrtTrackingNumber(number)).toBe(false);
      expect(detectCarrierMatch(number).candidates ?? []).not.toContain('brt');
    }
    expect(isBrtTrackingNumber('eob99099100000000015')).toBe(false);
  });

  it('prioritizes documented bpost prefixes while preserving overlapping numeric candidates', () => {
    for (const number of ['323201000000000001', '323200000000000000000001', '329900000000000000000001']) {
      const detected = detectCarrierMatch(number);
      expect(detected).toMatchObject({ carrier: 'unknown', confidence: 'low', preferred: ['bpost'] });
      expect(detected.candidates[0]).toBe('bpost');
      expect(recognitionAskedCarriers(number)[0]).toBe('bpost');
      expect(detected.candidates.length).toBeGreaterThan(1);
    }
    for (const number of ['600000000000000000000001', '32320000000000001', '3232000000000000000000001']) {
      expect(detectCarrierMatch(number).preferred).not.toContain('bpost');
    }
    // Four zeros after five digits is also Ecoscooting's postcode layout.
    expect(detectCarrierMatch('323200000000000001').preferred).toEqual(['bpost', 'ecoscooting']);
  });

  it('names bpost for its S10 numbers, but not for a U barcode, which bpost does not track', () => {
    expect(detectCarrierMatch('CE123456785BE')).toMatchObject({ carrier: 'bpost', confidence: 'high' });
    for (const number of ['UA123456785BE', 'UZ123456785BE']) {
      expect(detectCarrierMatch(number).candidates).not.toContain('bpost');
    }
  });

  it('names bpost for its JJBE licence plate in its letter and parcel lengths only', () => {
    for (const number of ['JJBEA000000000000000001', 'JJBEA0000000000000000000001']) {
      expect(detectCarrierMatch(number)).toMatchObject({ carrier: 'bpost', confidence: 'high' });
    }
    for (const number of ['JJBEA000000000000000000001', 'JJBEA00000000000000000000001']) {
      expect(detectCarrierMatch(number).candidates).not.toContain('bpost');
    }
  });

  it('reads DHL eCommerce Iberia shipment links in each of the tracking page\'s languages', () => {
    for (const page of ['ModificarEnvio', 'ModificarMeuEnvio', 'ModifyMyShipment']) {
      for (const suffix of ['', '/', '/00000']) {
        expect(parseTrackingInput(`https://clientesparcel.dhl.es/LiveTracking/${page}/0000000001${suffix}`))
          .toMatchObject({ trackingNumber: '0000000001', carrier: 'dhl-ecommerce-es', confidence: 'high', source: 'link' });
      }
    }
    expect(parseTrackingInput('https://clientesparcel.dhl.es/LiveTracking/SinDatos').source).toBe('none');
  });

  it('reads DPD Ireland links from its tracker host and any dpd.ie page', () => {
    for (const link of [
      'https://tracking.dpd.ie/?deviceType=5&consignmentNumber=',
      'https://tracking.dpd.ie/?consignmentNumber=',
      'https://www.dpd.ie/tracking/?consignmentNumber=',
      'https://dpd.ie/tracking?deviceType=5&consignmentNumber=',
      'https://www.dpd.ie/track-my-parcel/?consignmentNumber=',
    ]) {
      expect(parseTrackingInput(`${link}000000001`))
        .toMatchObject({ trackingNumber: '000000001', carrier: 'dpd-ie', confidence: 'high', source: 'link' });
    }
  });

  it('lists Bring first for its GS1-checked parcel and consignment numbers and reads its tracking links', () => {
    for (const number of ['370001000000000003', '373001000000000004', '00370000000000000004', '70000000000000003']) {
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
    // AliExpress shows buyers the last shape while the parcel is on Cainiao's leg, so Cainiao is asked beside Poste.
    for (const { number, candidates, asked } of [
      { number: '990001A000001', candidates: ['poste-italiane'], asked: ['poste-italiane'] },
      { number: '3C9900A000001', candidates: ['poste-italiane'], asked: ['poste-italiane'] },
      { number: '1C9900A000001', candidates: ['poste-italiane'], asked: ['poste-italiane'] },
      { number: 'D99000A000001', candidates: ['poste-italiane'], asked: ['poste-italiane'] },
      { number: '990A00000001A', candidates: ['aliexpress', 'poste-italiane'], asked: ['poste-italiane', 'aliexpress'] },
    ]) {
      expect(isPosteItalianeTrackingNumber(number)).toBe(true);
      expect(detectCarrierMatch(number)).toMatchObject({ carrier: 'unknown', confidence: 'low', candidates });
      expect(recognitionAskedCarriers(number)).toEqual(asked);
      expect(parseTrackingInput(`Tracking number: ${number}`)).toMatchObject({ trackingNumber: number, carrier: 'unknown', candidates });
      expect(isPosteItalianeTrackingNumber(number.slice(1))).toBe(false);
    }
    expect(isPosteItalianeTrackingNumber('ABCDEF0000001')).toBe(false);
  });

  it('assigns Poste Delivery Europe numbers to Poste Italiane and leaves other S10 numbers alone', () => {
    expect(isPosteItalianeTrackingNumber('CW123456785IT')).toBe(true);
    expect(detectCarrierMatch('CW123456785IT')).toMatchObject({ carrier: 'poste-italiane', confidence: 'high' });
    // A failed check digit is no Poste number, and other Italian or foreign S10 numbers stay postal.
    expect(isPosteItalianeTrackingNumber('CW123456780IT')).toBe(false);
    expect(detectCarrierMatch('CW123456780IT').candidates).not.toContain('poste-italiane');
    for (const number of ['CP123456785IT', 'CW123456785FR']) {
      expect(isPosteItalianeTrackingNumber(number)).toBe(false);
      expect(detectCarrierMatch(number).carrier).not.toBe('poste-italiane');
    }
    expect(detectCarrierMatch('CP123456785IT')).toMatchObject({ carrier: 'intl-post', confidence: 'high' });
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

describe('wave six European prefixes', () => {
  // Synthetic numbers in each carrier's layout; none is a real parcel.
  it('names CityMail for its BCM references, including the twelve-character ones Colis Privé also fits', () => {
    for (const number of ['BCMAB0000001', 'BCMA00000001', 'BCMABC000000001']) {
      expect(detectCarrierMatch(number), number).toMatchObject({ carrier: 'citymail', confidence: 'high', candidates: ['citymail'] });
    }
    for (const number of ['BCM0000001', 'BCMAB00000', 'BCMABCD0000000']) expect(detectCarrierMatch(number).candidates ?? [], number).not.toContain('citymail');
  });

  it('names Intereuropa only for NRSI and nine digits', () => {
    expect(detectCarrierMatch('NRSI000000001')).toMatchObject({ carrier: 'intereuropa', confidence: 'high' });
    for (const number of ['NRSI00000001', 'NRSI0000000001', 'NRSIA00000001', 'NRSE000000001']) {
      expect(detectCarrierMatch(number).candidates ?? [], number).not.toContain('intereuropa');
    }
  });

  it('names Pannon XP for its 35814 parcels and leaves other 24-digit numbers to the carriers sharing that length', () => {
    expect(detectCarrierMatch('358140000000000000000001')).toMatchObject({ carrier: 'pannon-xp', confidence: 'high' });
    expect(detectCarrierMatch('358150000000000000000001')).toMatchObject({ carrier: 'unknown', confidence: 'low' });
    for (const number of ['358150000000000000000001', '35814000000000000000001', '3581400000000000000000001']) {
      expect(detectCarrierMatch(number).candidates ?? [], number).not.toContain('pannon-xp');
    }
  });

  it('names Torrestir for M001 numbers with their service character, and nothing else', () => {
    for (const number of ['M0010000A00000000001', 'M0010000000000000001']) {
      expect(detectCarrierMatch(number), number).toMatchObject({ carrier: 'torrestir', confidence: 'high' });
    }
    for (const number of ['M001000000000000000001', 'M0020000A00000000001', 'M0010000AB0000000001', 'M001000A00000000001']) {
      expect(detectCarrierMatch(number).candidates ?? [], number).not.toContain('torrestir');
    }
  });
});

describe('wave six courier rules', () => {
  // Synthetic numbers in each carrier's layout; none is a real parcel.
  it('names FG Delivery for the Cainiao codes its FLM suffix hands to Fulmine', () => {
    expect(detectCarrierMatch('CNITAB00000001FLM')).toMatchObject({ carrier: 'fg-delivery', confidence: 'high', candidates: ['fg-delivery'] });
    for (const number of ['CNITAB0000001FLM', 'CNITA000000001FLM', 'CNITAB00000001FLX']) {
      expect(detectCarrierMatch(number).candidates ?? [], number).not.toContain('fg-delivery');
    }
  });

  it('names LogoiX only for LIX and ten digits', () => {
    expect(detectCarrierMatch('LIX0000000001')).toMatchObject({ carrier: 'logoix', confidence: 'high' });
    for (const number of ['LIX000000001', 'LIX00000000001', 'LIXA000000001']) {
      expect(detectCarrierMatch(number).candidates ?? [], number).not.toContain('logoix');
    }
  });

  it('suggests Fermopoint for Fermoticket codes without naming it', () => {
    expect(detectCarrierMatch('A0B0CDE000001')).toMatchObject({ carrier: 'unknown', confidence: 'low', candidates: ['fermopoint'] });
    for (const number of ['00B0CDE000001', 'A0B0CD0000001']) expect(detectCarrierMatch(number).candidates ?? [], number).not.toContain('fermopoint');
  });

  it('names Peddler for its P and NLEXP labels', () => {
    for (const number of ['P000000000000000001', 'NLEXP0000000001INTPED']) {
      expect(detectCarrierMatch(number), number).toMatchObject({ carrier: 'peddler', confidence: 'high', candidates: ['peddler'] });
    }
    for (const number of ['P00000000000000001', 'P0000000000000000001', 'NLEXP000000001INTPED', 'NLEXP0000000001INTPOD']) {
      expect(detectCarrierMatch(number).candidates ?? [], number).not.toContain('peddler');
    }
  });

  it('suggests TWS Express after Poste Italiane for the SDA-shaped waybills it delivers, and asks only Poste', () => {
    expect(detectCarrierMatch('280000A000001')).toMatchObject({ carrier: 'unknown', confidence: 'low', candidates: ['poste-italiane', 'tws-express'] });
    expect(recognitionAskedCarriers('280000A000001')).toEqual(['poste-italiane']);
    for (const number of ['270000A000001', '280000A00001', '2800000000001']) {
      expect(detectCarrierMatch(number).candidates ?? [], number).not.toContain('tws-express');
    }
  });

  it('suggests nox for its dated 22000 barcodes beside the other 24-digit carriers', () => {
    const barcode = `22000${'0000001'}261017${'000001'}`;
    expect(detectCarrierMatch(barcode)).toMatchObject({ carrier: 'unknown', confidence: 'low' });
    expect(detectCarrierMatch(barcode).candidates).toEqual(expect.arrayContaining(['nox', 'inpost']));
    for (const number of [`22000${'0000001'}261317${'000001'}`, `22000${'0000001'}261032${'000001'}`, `23000${'0000001'}261017${'000001'}`]) {
      expect(detectCarrierMatch(number).candidates ?? [], number).not.toContain('nox');
    }
  });
});

describe('SHEIN package numbers Paack delivers in Spain', () => {
  it.each(['C26010100000001', 'E25123100000001', 'C24022900000001'])('suggests Paack for %s', (number) => {
    expect(detectCarrierMatch(number)).toMatchObject({ carrier: 'unknown', confidence: 'low', candidates: ['paack'] });
    // Paack needs the postcode, so recognition cannot confirm it.
    expect(recognitionAskedCarriers(number)).toEqual([]);
  });

  it.each(['C26130100000001', 'C26003100000001', 'C26013200000001', 'D26010100000001', 'C16010100000001', 'C2601010000001', 'C260101000000001'])(
    'leaves %s, not a dated SHEIN number, without Paack', (number) => {
      expect(detectCarrierMatch(number).candidates).not.toContain('paack');
    },
  );
});

describe('wave seven courier rules', () => {
  // Synthetic numbers in each carrier's layout; none is a real parcel.
  it('suggests DPD Austria first for its depot codes and keeps the DPD networks out of recognition', () => {
    for (const number of ['06200000000001', '06300000000001', '06350000000001', '06430000000001', '06490000000001']) {
      expect(detectCarrierMatch(number), number).toMatchObject({ carrier: 'unknown', confidence: 'low' });
      expect(detectCarrierMatch(number).candidates?.[0], number).toBe('dpd-at');
      expect(recognitionAskedCarriers(number).filter((carrier) => carrier.startsWith('dpd')), number).toEqual([]);
    }
    for (const number of ['06310000000001', '06460000000001', '06100000000001', '0620000000001', '062000000000001']) {
      expect(detectCarrierMatch(number).candidates ?? [], number).not.toContain('dpd-at');
    }
  });

  it('suggests Drop2Shop for GLB and thirteen digits without naming it', () => {
    expect(detectCarrierMatch('GLB0000000000001')).toMatchObject({ carrier: 'unknown', confidence: 'low', candidates: ['drop2shop'] });
    for (const number of ['GLB000000000001', 'GLB00000000000001', 'GLC0000000000001']) {
      expect(detectCarrierMatch(number).candidates ?? [], number).not.toContain('drop2shop');
    }
  });

  it('names Precision Deliveries for ASL and ten digits, its former name', () => {
    expect(detectCarrierMatch('ASL0000000001')).toMatchObject({ carrier: 'precision-deliveries', confidence: 'high', candidates: ['precision-deliveries'] });
    for (const number of ['ASL000000001', 'ASL00000000001', 'ASM0000000001']) {
      expect(detectCarrierMatch(number).candidates ?? [], number).not.toContain('precision-deliveries');
    }
  });

  it('names Energo only for its dashed EN numbers', () => {
    expect(detectCarrierMatch('EN00-000000-1')).toMatchObject({ carrier: 'energo', confidence: 'high', candidates: ['energo'] });
    for (const number of ['EN000000001', 'EN00-000000-12', 'EN0-0000000-1']) {
      expect(detectCarrierMatch(number).candidates ?? [], number).not.toContain('energo');
    }
  });

  it('names Tgroup for 3010TGR and fourteen digits', () => {
    expect(detectCarrierMatch('3010TGR00000000000001')).toMatchObject({ carrier: 't-group', confidence: 'high', candidates: ['t-group'] });
    for (const number of ['3010TGR0000000000001', '3011TGR00000000000001']) {
      expect(detectCarrierMatch(number).candidates ?? [], number).not.toContain('t-group');
    }
  });
});
