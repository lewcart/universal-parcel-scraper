import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { StepRecorder } from '../../core/telemetry/index.js';
import { recognizeFromLookup } from '../../core/adapter/index.js';
import {
  FedExTracker,
  fedexTrackingUrl,
  parseFedExTrackingHtml,
  parseFedExTrackingResponse,
} from './adapter.js';
import { FEDEX_CODE_STAGE, fedexStage, fedexStatus } from './status.js';

// 999999999999 and 999999999998 are made-up numbers in FedEx's published
// format. No real shipment, recipient, signatory or session value appears in
// this file; the fixtures carry PRIVATE … placeholders instead.
const DELIVERED_NUMBER = '999999999999';
const IN_TRANSIT_NUMBER = '999999999998';
const HELD_NUMBER = '999999999996';
// Made-up Ground Economy numbers: a service type code, a Mailer ID of nines and
// a serial, closed by the check digit computed with 92 in front.
const GROUND_ECONOMY_NUMBER = '61299999999900000010';
const OTHER_GROUND_ECONOMY_NUMBER = '61299999999900000034';
const TRACK_API = 'https://api.fedex.com/track/v2/shipments';
const TRAWL_URL = 'http://trawl.internal:8191';
const DELIVERED = JSON.parse(
  readFileSync(new URL('./fixtures/delivered.json', import.meta.url), 'utf8'),
) as Record<string, unknown>;
const IN_TRANSIT = JSON.parse(
  readFileSync(new URL('./fixtures/in-transit.json', import.meta.url), 'utf8'),
) as Record<string, unknown>;
const HELD = JSON.parse(
  readFileSync(new URL('./fixtures/held.json', import.meta.url), 'utf8'),
) as Record<string, unknown>;
const CAPABILITIES = (JSON.parse(
  readFileSync(new URL('./carrier.json', import.meta.url), 'utf8'),
) as { capabilities: string[] }).capabilities;

function deliveredFixture(): Record<string, unknown> {
  return structuredClone(DELIVERED);
}

function inTransitFixture(): Record<string, unknown> {
  return structuredClone(IN_TRANSIT);
}

/** The held fixture's package, changed by `edit` first. */
function heldFixture(edit: (shipment: Record<string, unknown>) => void = () => {}): Record<string, unknown> {
  const payload = structuredClone(HELD);
  edit((payload.output as { packages: Record<string, unknown>[] }).packages[0]!);
  return payload;
}

/** A Ground Economy parcel with these scans, newest first: [date, code, status, details]. */
function groundEconomyFixture(scans: readonly (readonly [string, string, string, string])[], number = GROUND_ECONOMY_NUMBER): Record<string, unknown> {
  const payload = deliveredFixture();
  const shipment = (payload.output as { packages: Record<string, unknown>[] }).packages[0]!;
  shipment.trackingNbr = number;
  shipment.displayTrackingNbr = number;
  // The package status follows the newest scan.
  shipment.keyStatusCD = scans[0]?.[1] ?? '';
  shipment.keyStatus = scans[0]?.[2] ?? '';
  shipment.statusWithDetails = '';
  shipment.scanEventList = scans.map(([date, statusCD, status, scanDetails]) => ({
    date, time: '10:00:00', gmtOffset: '-05:00', scanLocation: 'EXAMPLE CITY, TN', status, statusCD, scanDetails,
  }));
  return payload;
}

const USPS_SCANS = [
  ['2026-06-08', 'DL', 'Delivered', 'Package delivered by U.S. Postal Service to addressee'],
  ['2026-06-08', 'OD', 'Out for delivery', 'Out for delivery with the U.S. Postal Service'],
  ['2026-06-07', 'AR', 'At U.S. Postal Service facility', `Accepted by U.S. Postal Service - Tracking ID 92${GROUND_ECONOMY_NUMBER}`],
  ['2026-06-05', 'DP', 'Departed FedEx location', ''],
  ['2026-06-04', 'PU', 'Picked up', ''],
] as const;

function stepRecorder(): { recorder: StepRecorder; records: string[] } {
  const records: string[] = [];
  return {
    records,
    recorder: {
      step: (record) => records.push(`${record.step}:${record.outcome}`),
      lookup: (record) => records.push(`lookup:${record.finalStep}:${record.outcome}`),
    },
  };
}

afterEach(() => vi.restoreAllMocks());

describe('FedEx status vocabulary', () => {
  it('maps the package code, the wording, and nothing else', () => {
    expect(FEDEX_CODE_STAGE.DL).toBe('delivered');
    expect(FEDEX_CODE_STAGE.OD).toBe('out_for_delivery');
    expect(FEDEX_CODE_STAGE.DE).toBe('failed_attempt');
    expect(FEDEX_CODE_STAGE.OC).toBe('registered');
    expect(fedexStage('Customer not available or business closed')).toBe('failed_attempt');
    expect(fedexStage('Returning to shipper')).toBe('returned');
    expect(fedexStage('Clearance in progress')).toBe('customs');
    expect(fedexStatus('DL', 'On FedEx vehicle for delivery')).toBe('delivered');
    expect(fedexStatus('OD', 'Delivered')).toBe('out_for_delivery');
    // Unrecognized wording only means "moving" once the shipment has scans.
    expect(fedexStatus('XX', 'Wording FedEx has not used before')).toBe('unknown');
    expect(fedexStatus('XX', 'Wording FedEx has not used before', true)).toBe('in_transit');
    expect(fedexStage('Wording FedEx has not used before')).toBeNull();
  });

  it('reads a hold at location as ready for pickup only once the parcel waits there', () => {
    expect(FEDEX_CODE_STAGE.HL).toBe('ready_for_pickup');
    expect(FEDEX_CODE_STAGE.HP).toBe('ready_for_pickup');
    expect(FEDEX_CODE_STAGE.RR).toBe('in_transit');
    expect(FEDEX_CODE_STAGE.HA).toBe('in_transit');
    expect(fedexStatus('HL', 'Wording FedEx has not used before')).toBe('out_for_delivery');
    expect(fedexStage('Ready for pickup')).toBe('ready_for_pickup');
    // A hold for a problem keeps its exception reading.
    expect(fedexStatus('SE', 'Shipment exception — held at FedEx location')).toBe('exception');
    expect(fedexStage('Package held at FedEx location')).toBe('exception');
  });
});

describe('FedEx structured response', () => {
  it('projects the delivered scan history with per-scan offsets', () => {
    const result = parseFedExTrackingResponse(deliveredFixture(), DELIVERED_NUMBER);
    expect(result).toMatchObject({
      status: 'delivered',
      current_stage: 'delivered',
      last_status_text: 'Delivered',
      last_update: '2026-09-02T11:58:00+02:00',
      delivered_at: '2026-09-02T11:58:00+02:00',
      expected_delivery: null,
    });
    expect(result.events).toEqual([
      { time: '2026-09-02T11:58:00+02:00', location: 'ZUERICH, CH', description: 'Delivered', stage: 'delivered' },
      { time: '2026-09-01T08:12:00+02:00', location: 'KOELN, DE', description: 'Departed FedEx location', stage: 'in_transit' },
      { time: '2026-08-31T15:00:00+09:00', location: 'SEOUL, KR', description: 'Picked up', stage: 'accepted' },
      { time: '2026-08-30T09:05:00+09:00', location: 'SEOUL, KR', description: 'Shipment information sent to FedEx', stage: 'registered' },
    ]);
  });

  it('projects an out-for-delivery parcel with its estimate', () => {
    const result = parseFedExTrackingResponse(inTransitFixture(), IN_TRANSIT_NUMBER);
    expect(result).toMatchObject({
      status: 'out_for_delivery',
      current_stage: 'out_for_delivery',
      last_status_text: 'On FedEx vehicle for delivery',
      last_update: '2026-09-25T09:04:00+02:00',
      expected_delivery: '2026-09-25',
    });
    expect(result.events).toHaveLength(4);
    expect(result.events?.[0]).toMatchObject({ stage: 'out_for_delivery' });
    expect(result).not.toHaveProperty('delivered_at');
  });

  it('orders scans by their instant, not by their local date, and an undated scan last', () => {
    const payload = inTransitFixture();
    const shipment = (payload.output as { packages: Record<string, unknown>[] }).packages[0]!;
    const scan = (date: string, time: string, gmtOffset: string, scanLocation: string, status: string, statusCD: string) =>
      ({ date, time, gmtOffset, scanLocation, status, statusCD, scanDetails: '' });
    shipment.scanEventList = [
      scan('', '', '', 'EXAMPLE CITY, TN', 'Shipment information sent to FedEx', 'OC'),
      // 14:00 UTC, the older scan despite its later local date.
      scan('2026-09-11', '00:00:00', '+10:00', 'SYDNEY, AU', 'Departed FedEx location', 'DP'),
      // 15:00 UTC.
      scan('2026-09-10', '05:00:00', '-10:00', 'HONOLULU, HI', 'Arrived at FedEx location', 'AR'),
    ];
    const result = parseFedExTrackingResponse(payload, IN_TRANSIT_NUMBER);
    expect(result.events?.map((event) => event.time))
      .toEqual(['2026-09-10T05:00:00-10:00', '2026-09-11T00:00:00+10:00', undefined]);
    expect(result.last_update).toBe('2026-09-10T05:00:00-10:00');
  });

  it('keeps the recipient, shipper and service blocks out of the result', () => {
    const serialized = JSON.stringify(parseFedExTrackingResponse(deliveredFixture(), DELIVERED_NUMBER));
    for (const value of [
      'PRIVATE RECIPIENT', 'PRIVATE SHIPPER', 'PRIVATE PHONE',
      'receivedByNm', 'shipperCmpnyName', 'recipientPhoneNbr',
      'serviceDesc', 'INTERNATIONAL_PRIORITY', 'totalKgsWgt', 'dimensions',
    ]) {
      expect(serialized).not.toContain(value);
    }
  });

  it('produces every capability carrier.json declares', () => {
    const result = parseFedExTrackingResponse(deliveredFixture(), DELIVERED_NUMBER);
    expect(CAPABILITIES).toEqual(['history', 'location', 'eta', 'delivered_at', 'pickup_point', 'delivery_partner', 'delivery_tracking_number']);
    expect(result.events?.length).toBeGreaterThan(0);
    expect(result.events?.some((event) => event.location)).toBe(true);
    expect(result.delivered_at).toBeTruthy();
    expect(parseFedExTrackingResponse(inTransitFixture(), IN_TRANSIT_NUMBER).expected_delivery).toBeTruthy();
    expect(parseFedExTrackingResponse(heldFixture(), HELD_NUMBER).pickup_point).toBeTruthy();
    const handedOver = parseFedExTrackingResponse(groundEconomyFixture(USPS_SCANS), GROUND_ECONOMY_NUMBER);
    expect(handedOver.delivery_carrier).toBeTruthy();
    expect(handedOver.delivery_tracking_number).toBeTruthy();
  });

  it('names the hold location while the parcel is ready for pickup', () => {
    const result = parseFedExTrackingResponse(heldFixture(), HELD_NUMBER);
    expect(result).toMatchObject({
      status: 'out_for_delivery',
      current_stage: 'ready_for_pickup',
      last_status_text: 'Ready for pickup',
      last_update: '2026-10-06T14:20:00-05:00',
      expected_delivery: null,
      pickup_point: 'FEDEX OFFICE PRINT & SHIP CENTER\n100 EXAMPLE AVE\nSUITE 2\nMEMPHIS, TN 38118',
    });
    expect(result.events?.map((event) => [event.description, event.stage])).toEqual([
      ['Ready for pickup', 'ready_for_pickup'],
      ['Hold at location request accepted', 'in_transit'],
      ['Delivery option requested', 'in_transit'],
      ['Arrived at FedEx location', 'in_transit'],
      ['Picked up', 'accepted'],
    ]);
    // An `HP` package is ready for pickup too.
    expect(parseFedExTrackingResponse(heldFixture((shipment) => { shipment.keyStatusCD = 'HP'; }), HELD_NUMBER))
      .toMatchObject({ current_stage: 'ready_for_pickup', pickup_point: result.pickup_point });
  });

  it('names USPS and its package number once USPS has a Ground Economy parcel', () => {
    const result = parseFedExTrackingResponse(groundEconomyFixture(USPS_SCANS), GROUND_ECONOMY_NUMBER);
    expect(result).toMatchObject({
      status: 'delivered',
      current_stage: 'delivered',
      delivery_carrier: 'usps',
      delivery_tracking_number: `92${GROUND_ECONOMY_NUMBER}`,
    });
    expect(result.events?.map((event) => event.stage)).toEqual(['delivered', 'out_for_delivery', 'in_transit', 'in_transit', 'accepted']);
    // Before USPS has it, FedEx alone tracks the parcel.
    expect(parseFedExTrackingResponse(groundEconomyFixture(USPS_SCANS.slice(3)), GROUND_ECONOMY_NUMBER))
      .not.toHaveProperty('delivery_carrier');
  });

  it('names no partner while delivery stays with FedEx Ground', () => {
    const result = parseFedExTrackingResponse(groundEconomyFixture([
      ['2026-06-08', 'OD', 'On FedEx vehicle for delivery', ''],
      ['2026-06-07', 'AF', 'At local FedEx facility', 'Delivery scheduled via FedEx Ground, not US Postal Service'],
      ['2026-06-04', 'PU', 'Picked up', ''],
    ]), GROUND_ECONOMY_NUMBER);
    expect(result).toMatchObject({ status: 'out_for_delivery', current_stage: 'out_for_delivery' });
    expect(result.events?.[1]).toMatchObject({ stage: 'in_transit' });
    expect(result).not.toHaveProperty('delivery_carrier');
    expect(result).not.toHaveProperty('delivery_tracking_number');
    // Nor when a scan says USPS will not have the parcel.
    for (const details of [
      'Package will not be delivered by U.S. Postal Service',
      'This package is no longer with the U.S. Postal Service',
      'Never accepted by the US Postal Service',
    ]) {
      const negated = groundEconomyFixture([['2026-06-07', 'AF', 'At local FedEx facility', details]]);
      expect(parseFedExTrackingResponse(negated, GROUND_ECONOMY_NUMBER), details).not.toHaveProperty('delivery_carrier');
    }
  });

  it('takes the package number the USPS scan names, else the Ground Economy number with 92', () => {
    const named = groundEconomyFixture([
      ['2026-06-07', 'AR', 'At U.S. Postal Service facility', `Accepted by U.S. Postal Service - Tracking ID 92${OTHER_GROUND_ECONOMY_NUMBER}`],
    ]);
    expect(parseFedExTrackingResponse(named, GROUND_ECONOMY_NUMBER))
      .toMatchObject({ delivery_carrier: 'usps', delivery_tracking_number: `92${OTHER_GROUND_ECONOMY_NUMBER}` });
    const unnamed = [['2026-06-08', 'OD', 'Out for delivery', 'Out for delivery with the U.S. Postal Service']] as const;
    expect(parseFedExTrackingResponse(groundEconomyFixture(unnamed), GROUND_ECONOMY_NUMBER))
      .toMatchObject({ delivery_carrier: 'usps', delivery_tracking_number: `92${GROUND_ECONOMY_NUMBER}` });
    // A named number that is not a USPS package number, or a failing check
    // digit on the number asked, leaves no number to follow.
    const unusable = groundEconomyFixture([
      ['2026-06-07', 'AR', 'At U.S. Postal Service facility', 'Accepted by U.S. Postal Service - Tracking ID 9261299999999900000011'],
    ], '61299999999900000011');
    expect(parseFedExTrackingResponse(unusable, '61299999999900000011')).not.toHaveProperty('delivery_carrier');
    expect(parseFedExTrackingResponse(groundEconomyFixture(unnamed, DELIVERED_NUMBER), DELIVERED_NUMBER))
      .not.toHaveProperty('delivery_carrier');
  });

  it('writes a hold location without a state as postcode and town', () => {
    const result = parseFedExTrackingResponse(heldFixture((shipment) => {
      shipment.halCmpnyName = 'FEDEX STATION';
      shipment.halAddress = { streetLines: ['1 RUE EXEMPLE'], city: 'PARIS', stateOrProvinceCode: '', postalCode: '75001', countryCode: 'FR' };
    }), HELD_NUMBER);
    expect(result.pickup_point).toBe('FEDEX STATION\n1 RUE EXEMPLE\n75001 PARIS');
  });

  it('keeps the name alone without a street or town, and nothing without a name', () => {
    for (const address of [
      { streetLines: [], city: 'MEMPHIS', stateOrProvinceCode: 'TN', postalCode: '38118' },
      { streetLines: ['100 EXAMPLE AVE'], city: '', stateOrProvinceCode: 'TN', postalCode: '38118' },
      null,
    ]) {
      expect(parseFedExTrackingResponse(heldFixture((shipment) => { shipment.halAddress = address; }), HELD_NUMBER).pickup_point)
        .toBe('FEDEX OFFICE PRINT & SHIP CENTER');
    }
    const unnamed = parseFedExTrackingResponse(heldFixture((shipment) => { shipment.halCmpnyName = ''; }), HELD_NUMBER);
    expect(unnamed).toMatchObject({ current_stage: 'ready_for_pickup' });
    expect(unnamed).not.toHaveProperty('pickup_point');
  });

  it('never names a residential hold address', () => {
    for (const edit of [
      (shipment: Record<string, unknown>) => { shipment.halresidential = true; },
      (shipment: Record<string, unknown>) => { (shipment.halAddress as Record<string, unknown>).residential = true; },
    ]) {
      expect(parseFedExTrackingResponse(heldFixture(edit), HELD_NUMBER)).not.toHaveProperty('pickup_point');
    }
  });

  it('reads no hold location before the parcel waits there', () => {
    const accepted = parseFedExTrackingResponse(heldFixture((shipment) => {
      shipment.keyStatus = 'Hold at location request accepted';
      shipment.keyStatusCD = 'HA';
      shipment.scanEventList = (shipment.scanEventList as unknown[]).slice(1);
    }), HELD_NUMBER);
    expect(accepted).toMatchObject({ status: 'in_transit', current_stage: 'in_transit' });
    expect(accepted).not.toHaveProperty('pickup_point');
  });

  it('keeps the recipient, shipper and destination of a held parcel out of the result', () => {
    const serialized = JSON.stringify(parseFedExTrackingResponse(heldFixture(), HELD_NUMBER));
    expect(serialized).not.toContain('PRIVATE');
    expect(serialized).not.toContain('XMEMA');
  });

  it('fails closed on another parcel, duplicates and invalid envelopes', () => {
    const other = deliveredFixture();
    ((((other.output as Record<string, unknown>).packages as Record<string, unknown>[])[0]!)).trackingNbr = '999999999997';
    expect(() => parseFedExTrackingResponse(other, DELIVERED_NUMBER))
      .toThrow('FedEx did not return the requested parcel');
    const duplicated = deliveredFixture();
    ((duplicated.output as Record<string, unknown>).packages as unknown[]).push(
      ((deliveredFixture().output as Record<string, unknown>).packages as unknown[])[0],
    );
    expect(() => parseFedExTrackingResponse(duplicated, DELIVERED_NUMBER))
      .toThrow('several shipments');
    expect(() => parseFedExTrackingResponse({ output: {} }, DELIVERED_NUMBER))
      .toThrow('invalid tracking response');
    expect(() => parseFedExTrackingResponse('not an object', DELIVERED_NUMBER))
      .toThrow('invalid tracking response');
  });

  it('reports an empty answer as unlocated and a gated shipment as input-required', () => {
    expect(parseFedExTrackingResponse({ output: { packages: [] } }, DELIVERED_NUMBER)).toMatchObject({
      status: 'unknown',
      events: [],
      last_status_text: 'FedEx could not locate the shipment',
    });
    expect(() => parseFedExTrackingResponse({
      output: { packages: [], errorList: [{ code: 'TRACKING.AUTHORIZATION.ERROR', message: 'Verification required' }] },
    }, DELIVERED_NUMBER)).toThrow('recipient verification');
    expect(parseFedExTrackingResponse({
      output: {
        packages: [{
          trackingNbr: DELIVERED_NUMBER,
          errorList: [{ code: 'TRACKING.TRACKINGNUMBER.NOTFOUND', message: 'Not found' }],
        }],
      },
    }, DELIVERED_NUMBER)).toMatchObject({ status: 'unknown', events: [] });
  });

  it('never recognizes a not-found placeholder despite its default status and scan', async () => {
    const payload = { output: { packages: [{
      trackingNbr: IN_TRANSIT_NUMBER,
      keyStatus: 'In transit', keyStatusCD: '', scanEventList: [{}],
      errorList: [{ code: 'TRACKING.TRACKINGNUMBER.NOTFOUND' }],
    }] } };
    const result = parseFedExTrackingResponse(payload, IN_TRANSIT_NUMBER);
    expect(result).toMatchObject({ status: 'unknown', events: [], last_update: null });
    expect(result).not.toHaveProperty('current_stage');
    await expect(recognizeFromLookup(async () => result)).resolves.toEqual({ known: false, lastActivityAt: null });
  });

});

describe('FedEx lookup steps', () => {
  it('reports the missing browser service without any request', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('must not fetch'));
    const { recorder, records } = stepRecorder();

    await expect(new FedExTracker({ trawlUrl: '', recorder }).fetch(DELIVERED_NUMBER))
      .rejects.toMatchObject({
        name: 'ChallengeError',
        status: 403,
        message: 'FedEx challenged direct tracking; configure FLARESOLVERR_URL for browser fallback',
      });

    expect(fetcher).not.toHaveBeenCalled();
    expect(records).toEqual([]);
  });

  it('reads the tracking reply the browser captured', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(Response.json({
      tier: 3,
      statusCode: 200,
      url: fedexTrackingUrl(DELIVERED_NUMBER),
      html: '<html><body>tracking app</body></html>',
      cookies: [],
      userAgent: 'Mozilla/5.0 (test browser)',
      capturedResponses: [
        { url: TRACK_API, status: 200, headers: {}, body: null, truncated: false, base64Encoded: false, error: 'unreadable' },
        { url: TRACK_API, status: 200, headers: {}, body: JSON.stringify(deliveredFixture()), truncated: false, base64Encoded: false, error: null },
      ],
    }));
    const { recorder, records } = stepRecorder();

    const result = await new FedExTracker({ timeoutMs: 2_000, trawlUrl: TRAWL_URL, recorder }).fetch(DELIVERED_NUMBER);

    expect(result).toMatchObject({
      status: 'delivered',
      tracking_source: 'structured-web-response',
      tracking_url: fedexTrackingUrl(DELIVERED_NUMBER),
    });
    expect(result.events?.length ?? 0).toBeGreaterThan(1);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(String(fetcher.mock.calls[0]?.[0])).toBe(`${TRAWL_URL}/scrape`);
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toMatchObject({
      url: fedexTrackingUrl(DELIVERED_NUMBER),
      skipHttp: true,
      maxTier: 3,
      captureResponses: [TRACK_API],
    });
    expect(records).toEqual(['trawl:ok', 'lookup:trawl:ok']);
  });

  it('names a challenged browser page instead of reporting an inconclusive load as not-found', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({
        tier: 3,
        statusCode: 200,
        url: fedexTrackingUrl(DELIVERED_NUMBER),
        html: '<html><body><h1>Access Denied</h1></body></html>',
        cookies: [],
        userAgent: 'Mozilla/5.0 (test browser)',
        capturedResponses: [],
      }), { headers: { 'Content-Type': 'application/json' } }));

    await expect(new FedExTracker({ timeoutMs: 2_000, trawlUrl: TRAWL_URL }).fetch(DELIVERED_NUMBER))
      .rejects.toMatchObject({ name: 'ChallengeError' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('preserves unreadable tracking JSON as a schema failure, never as not-found', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({
        tier: 3,
        statusCode: 200,
        url: fedexTrackingUrl(DELIVERED_NUMBER),
        html: '<html><body>We can’t find that tracking number.</body></html>',
        cookies: [],
        userAgent: 'Mozilla/5.0 (test browser)',
        capturedResponses: [
          { url: TRACK_API, status: 200, headers: {}, body: 'not json', truncated: false, base64Encoded: false, error: null },
        ],
      }), { headers: { 'Content-Type': 'application/json' } }));
    const { recorder, records } = stepRecorder();
    // The page renders this notice both for unknown numbers and for tracking
    // calls the edge refused, so only the structured reply decides not-found.
    await expect(new FedExTracker({ timeoutMs: 2_000, trawlUrl: TRAWL_URL, recorder }).fetch(DELIVERED_NUMBER))
      .rejects.toMatchObject({ name: 'SchemaError', message: 'FedEx returned unreadable tracking JSON' });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(records).toEqual(['trawl:schema', 'lookup:trawl:schema']);
  });

  it('keeps a page without a tracking reply inconclusive', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(Response.json({
      tier: 2, statusCode: 200, html: '<body>We cannot find that tracking number.</body>',
      capturedResponses: [],
    }));
    await expect(new FedExTracker({ trawlUrl: TRAWL_URL }).fetch(DELIVERED_NUMBER))
      .rejects.toMatchObject({ name: 'TransportError', kind: 'transport' });
  });

  it.each([401, 403])('preserves an API HTTP %s rejection even when the page looks normal', async (status) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(Response.json({
      tier: 2, statusCode: 200, html: '<body>Tracking app</body>',
      capturedResponses: [
        { url: TRACK_API, status: 200, body: JSON.stringify(deliveredFixture()) },
        { url: TRACK_API, status, body: null },
      ],
    }));
    const { recorder, records } = stepRecorder();
    await expect(new FedExTracker({ trawlUrl: TRAWL_URL, recorder }).fetch(DELIVERED_NUMBER))
      .rejects.toMatchObject({ name: 'ChallengeError', kind: 'challenge', status });
    expect(records).toEqual(['trawl:challenge', 'lookup:trawl:challenge']);
  });

  it('accepts a successful reply after an earlier browser rejection', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(Response.json({
      tier: 3, statusCode: 200, html: '<body>Tracking app</body>',
      capturedResponses: [
        { url: TRACK_API, status: 403, body: null },
        { url: TRACK_API, status: 200, body: JSON.stringify(deliveredFixture()) },
      ],
    }));
    await expect(new FedExTracker({ trawlUrl: TRAWL_URL }).fetch(DELIVERED_NUMBER))
      .resolves.toMatchObject({ status: 'delivered' });
  });

  it.each([
    [429, { 'retry-after': '120' }, { name: 'RateLimitedError', retryAfterMs: 120_000 }],
    [503, {}, { name: 'UpstreamHttpError', kind: 'maintenance' }],
    [404, {}, { name: 'TransportError', kind: 'transport' }],
  ])('keeps HTTP %s distinct from an unknown shipment', async (status, headers, expected) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(Response.json({
      tier: 2, statusCode: 200, html: '<body>Tracking app</body>',
      capturedResponses: [{ url: TRACK_API, status, headers, body: null }],
    }));
    await expect(new FedExTracker({ trawlUrl: TRAWL_URL }).fetch(DELIVERED_NUMBER))
      .rejects.toMatchObject({ ...expected, status });
  });

  it('preserves recipient-verification and identity errors from a captured reply', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch');
    for (const [body, expected] of [
      [{ output: { packages: [], errorList: [{ code: 'TRACKING.AUTHORIZATION.ERROR' }] } },
        { name: 'InputRequiredError', field: 'recipient verification' }],
      [{ output: { packages: [{ trackingNbr: IN_TRANSIT_NUMBER, keyStatus: 'Delivered' }] } },
        { name: 'SchemaError', message: 'FedEx did not return the requested parcel' }],
    ] as const) {
      fetcher.mockResolvedValueOnce(Response.json({
        tier: 2, statusCode: 200, html: '<body>Tracking app</body>',
        capturedResponses: [{ url: TRACK_API, status: 200, body: JSON.stringify(body) }],
      }));
      await expect(new FedExTracker({ trawlUrl: TRAWL_URL }).fetch(DELIVERED_NUMBER))
        .rejects.toMatchObject(expected);
    }
  });

  it('rejects a number that is not a FedEx number before any request', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('must not fetch'));
    const lookup = new FedExTracker({ trawlUrl: TRAWL_URL }).fetch('1Z999AA10123456784');
    await expect(lookup).rejects.toThrow('FedEx tracking numbers must contain 12, 15 or 20 digits');
    await expect(lookup).rejects.toMatchObject({ kind: 'invalid_input' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  // FedEx's published label examples: a 22-digit Ground `96` barcode and a
  // 34-digit barcode, each carrying its tracking number at the end.
  it.each([
    ['9611020987654312345672', '987654312345672'],
    ['9622 0015 6000 1234 5671 0079 4808 3905 94', '794808390594'],
  ])('tracks label barcode %s by the number it carries', async (barcode, number) => {
    const payload = deliveredFixture();
    const delivered = (payload.output as { packages: Record<string, unknown>[] }).packages[0]!;
    delivered.trackingNbr = number;
    delivered.displayTrackingNbr = number;
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(Response.json({
      tier: 3, statusCode: 200, html: '<body>Tracking app</body>',
      capturedResponses: [{ url: TRACK_API, status: 200, body: JSON.stringify(payload) }],
    }));

    const result = await new FedExTracker({ trawlUrl: TRAWL_URL }).fetch(barcode);

    expect(fedexTrackingUrl(barcode)).toBe(fedexTrackingUrl(number));
    expect(new URL(fedexTrackingUrl(barcode)).searchParams.get('trknbr')).toBe(number);
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toMatchObject({ url: fedexTrackingUrl(number) });
    expect(result).toMatchObject({ status: 'delivered', tracking_url: fedexTrackingUrl(number) });
  });

  it('tracks a twenty-digit Ground Economy number, even one whose check digit fails', async () => {
    for (const number of [GROUND_ECONOMY_NUMBER, '61299999999900000011']) {
      const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(Response.json({
        tier: 3, statusCode: 200, html: '<body>Tracking app</body>',
        capturedResponses: [{ url: TRACK_API, status: 200, body: JSON.stringify(groundEconomyFixture(USPS_SCANS.slice(3), number)) }],
      }));

      const result = await new FedExTracker({ trawlUrl: TRAWL_URL }).fetch(`${number.slice(0, 4)} ${number.slice(4)}`);

      expect(new URL(fedexTrackingUrl(number)).searchParams.get('trknbr')).toBe(number);
      expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toMatchObject({ url: fedexTrackingUrl(number) });
      expect(result).toMatchObject({ status: 'in_transit', tracking_url: fedexTrackingUrl(number) });
      fetcher.mockRestore();
    }
    for (const number of ['6129999999990000001', '612999999999000000100']) {
      await expect(new FedExTracker({ trawlUrl: TRAWL_URL }).fetch(number)).rejects.toMatchObject({ kind: 'invalid_input' });
    }
  });

  it('rejects a label barcode whose embedded number fails its check before any request', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('must not fetch'));
    for (const barcode of [
      '9611020987654312345673',
      '9622001560001234567100794808390595',
      // The 34-digit layout keeps two zeros before the 12-digit number.
      '9622001560001234567141794808390594',
    ]) {
      await expect(new FedExTracker({ trawlUrl: TRAWL_URL }).fetch(barcode))
        .rejects.toMatchObject({ kind: 'invalid_input' });
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('FedEx rendered page', () => {
  it('tells a challenge from an inconclusive load', () => {
    expect(parseFedExTrackingHtml('<html><body><h1>Access Denied</h1></body></html>')).toBe('challenged');
    expect(parseFedExTrackingHtml('<html><body>We can’t find that tracking number.</body></html>')).toBe('inconclusive');
  });

  it('builds the canonical tracking URL', () => {
    const url = new URL(fedexTrackingUrl(DELIVERED_NUMBER));
    expect(url.searchParams.get('trknbr')).toBe(DELIVERED_NUMBER);
  });
});
