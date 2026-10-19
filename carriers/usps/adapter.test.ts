import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { StepRecorder } from '../../core/telemetry/index.js';
import { parseTrackingInput } from '../../core/detection/index.js';
import { TrawlClient } from '../../core/transport/index.js';
import { normalizeUSPSNumber, parseUSPSTrackingHtml, USPSTracker, uspsTrackingUrl } from './adapter.js';
import { uspsStage, uspsStatus } from './status.js';

// 9400111899223397910421 and 9400111899223397910438 are made-up numbers in
// USPS's published format. No real shipment, recipient or signatory appears
// in this file.
const DELIVERED_NUMBER = '9400111899223397910421';
const IN_TRANSIT_NUMBER = '9400111899223397910438';
const TRAWL_URL = 'http://trawl.internal:8191';
const DELIVERED_PAGE = readFileSync(new URL('./fixtures/delivered.html', import.meta.url), 'utf8');
const IN_TRANSIT_PAGE = readFileSync(new URL('./fixtures/in-transit.html', import.meta.url), 'utf8');
const TIMELINE_PAGE = readFileSync(new URL('./fixtures/timeline.html', import.meta.url), 'utf8');
const HEADER_ONLY_PAGE = '<html><head><title>USPS Tracking® | USPS</title></head><body><div class="Widgets_Container"><div id="g-navigation">Navigation</div></div></body></html>';
// The bot check's interstitial: no title, no content, one inline script (synthetic here).
const HEAD_ONLY_PAGE = '<!DOCTYPE html><html lang="en"><head><title>USPS Tracking® | USPS</title><script src="scripts/libs/jquery.min.js"></script></head></html>';
const INTERSTITIAL_PAGE = '<!DOCTYPE html><html><head><title></title><style>html, body { margin: 0; }</style></head><body><script>(function () { /* synthetic check */ })();</script></body></html>';
const CAPABILITIES = (JSON.parse(
  readFileSync(new URL('./carrier.json', import.meta.url), 'utf8'),
) as { capabilities: string[] }).capabilities;

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

describe('USPS international numbers', () => {
  // Synthetic S10 serial; the check digit is independent of the country suffix.
  it.each(['CN', 'GB', 'CH', 'US'])('accepts a valid postal number issued in %s', (country) => {
    const raw = `lz 123.456-785 ${country.toLowerCase()}`;
    const expected = `LZ123456785${country}`;
    expect(normalizeUSPSNumber(raw)).toBe(expected);
    expect(uspsTrackingUrl(raw)).toBe(`https://tools.usps.com/tracking/${expected}`);
  });

  it.each(['LZ123456789CN', 'LZ123456789US', 'LZ12345678CN', 'LZ123456785C'])(
    'rejects invalid international number %s before making a request', async (number) => {
      const fetcher = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('must not fetch'));
      const lookup = new USPSTracker({ trawl: new TrawlClient(TRAWL_URL) }).fetch(number);
      await expect(lookup).rejects.toThrow('checksum-valid UPU S10');
      await expect(lookup).rejects.toMatchObject({ kind: 'invalid_input' });
      expect(fetcher).not.toHaveBeenCalled();
    });
});

describe('USPS status vocabulary', () => {
  it('maps the wording, and nothing else', () => {
    expect(uspsStage('Delivered, In/At Mailbox')).toBe('delivered');
    expect(uspsStage('Out for Delivery')).toBe('out_for_delivery');
    expect(uspsStage('Notice Left')).toBe('failed_attempt');
    expect(uspsStage('Pre-Shipment')).toBe('registered');
    expect(uspsStage('Available for Pickup')).toBe('ready_for_pickup');
    expect(uspsStage('Accepted at USPS Origin Facility')).toBe('accepted');
    expect(uspsStage('Arrived at USPS Facility')).toBe('in_transit');
    expect(uspsStage('Arrived at USPS Regional Facility')).toBe('in_transit');
    expect(uspsStatus('Delivered')).toBe('delivered');
    expect(uspsStatus('Out for Delivery')).toBe('out_for_delivery');
    // Unrecognized wording only means "moving" once the shipment has scans.
    expect(uspsStatus('Wording USPS has not used before')).toBe('unknown');
    expect(uspsStatus('Wording USPS has not used before', true)).toBe('in_transit');
    expect(uspsStage('Wording USPS has not used before')).toBeNull();
  });
});

describe('USPS rendered page', () => {
  it('reads current and collapsed timeline scans without letting old exceptions override delivery', () => {
    const result = parseUSPSTrackingHtml(TIMELINE_PAGE, DELIVERED_NUMBER);
    expect(result).toMatchObject({ status: 'delivered', current_stage: 'delivered', last_status_text: 'Delivered',
      last_update: '2025-03-14T12:17:00-04:00', expected_delivery: null });
    expect(result.events).toHaveLength(5);
    expect(result.events?.map(event => event.description)).toEqual([
      'Delivered', 'Out for Delivery', 'Notice Left (No Authorized Recipient Available)',
      'In Transit, Arriving On Time', 'Accepted at USPS Origin Facility',
    ]);
    expect(result.events?.[2]!.stage).toBe('failed_attempt');
    expect(result.events?.[3]).toEqual({ description: 'In Transit, Arriving On Time',
      local_time: '2025-03-12T16:31:00', stage: 'in_transit' });
    expect(result.events?.[4]!.time).toBe('2025-03-11T21:45:00-07:00');
    expect(JSON.stringify(result)).not.toContain('PRIVATE RECIPIENT');
  });

  it('reads USPS taking over a parcel its shipping partner already moved as transit', () => {
    const scan = (detail: string, date: string) => `<div class="tb-step collapsed"><div><p class="tb-status-detail">${detail}</p>`
      + `<p class="tb-location">EXAMPLE CITY, CA 00000</p><p class="tb-date">${date}</p></div></div>`;
    const steps = TIMELINE_PAGE.slice(TIMELINE_PAGE.indexOf('<div class="tb-step current-step">'), TIMELINE_PAGE.indexOf('<div class="tb-step"><p'));
    const page = TIMELINE_PAGE.replace('<div class="banner-header">Delivered</div>', '<div class="banner-header">In Transit</div>')
      .replace(steps, `<div class="tb-step current-step"><p class="tb-status">Accepted</p><p class="tb-status-detail">USPS in possession of item</p>`
        + '<p class="tb-location">EXAMPLE CITY, CA 00000</p><p class="tb-date">March 13, 2025 9:58 AM</p></div>'
        + scan('Departed Shipping Partner Facility', 'March 12, 2025 12:24 PM') + scan('Picked Up by Shipping Partner', 'March 11, 2025 2:18 PM'));
    const result = parseUSPSTrackingHtml(page, DELIVERED_NUMBER);
    expect(result.current_stage).toBe('in_transit');
    expect(result.events?.map(event => event.stage)).toEqual(['in_transit', 'in_transit', 'accepted']);
    // Without the partner's transit, USPS's own possession scan stays the acceptance.
    const alone = parseUSPSTrackingHtml(page.replace(scan('Departed Shipping Partner Facility', 'March 12, 2025 12:24 PM'), ''), DELIVERED_NUMBER);
    expect(alone.current_stage).toBe('accepted');
    expect(alone.events?.map(event => event.stage)).toEqual(['accepted', 'accepted']);
  });

  it('keeps an unresolved newest scan as local time and rejects another parcel’s timeline', () => {
    const result = parseUSPSTrackingHtml(TIMELINE_PAGE.replaceAll('EXAMPLE CITY, NY 00000', ''), DELIVERED_NUMBER);
    expect(result).toMatchObject({ last_update: null, last_update_local: '2025-03-14T12:17:00' });
    expect(result.events?.[0]!.time).toBeUndefined();
    expect(() => parseUSPSTrackingHtml(TIMELINE_PAGE, IN_TRANSIT_NUMBER)).toThrow('requested parcel');
  });

  it('reads the state a facility names before its kind', () => {
    for (const [facility, time] of [['EXAMPLE NY DISTRIBUTION CENTER', '2025-03-14T12:17:00-04:00'],
      ['EXAMPLE CITY CA NETWORK DISTRIBUTION CENTER', '2025-03-14T12:17:00-07:00'], ['ISC EXAMPLE CITY IL (USPS)', '2025-03-14T12:17:00-05:00']] as const) {
      const result = parseUSPSTrackingHtml(TIMELINE_PAGE.replace('EXAMPLE CITY, NY 00000', facility), DELIVERED_NUMBER);
      expect(result.events?.[0], facility).toMatchObject({ location: facility, time });
    }
    const unnamed = parseUSPSTrackingHtml(TIMELINE_PAGE.replace('EXAMPLE CITY, NY 00000', 'EXAMPLE DISTRIBUTION CENTER'), DELIVERED_NUMBER);
    expect(unnamed.events?.[0]).toMatchObject({ local_time: '2025-03-14T12:17:00' });
  });

  it('preserves a date-only update without inventing a clock time', () => {
    const result = parseUSPSTrackingHtml(TIMELINE_PAGE.replace('March 14, 2025 12:17 PM', 'March 14, 2025'), DELIVERED_NUMBER);
    expect(result.events?.[0]).toMatchObject({ description: 'Delivered', raw_time: 'March 14, 2025' });
    expect(result.events?.[0]!.time).toBeUndefined();
    expect(result.events?.[0]!.local_time).toBeUndefined();
    expect(result.last_update).toBeNull();
  });

  it('reads a clock time with seconds on the state\'s zone', () => {
    const result = parseUSPSTrackingHtml(TIMELINE_PAGE.replace('March 14, 2025 12:17 PM', 'March 14, 2025 12:17:35 pm'), DELIVERED_NUMBER);
    expect(result.events?.[0]).toMatchObject({ description: 'Delivered', time: '2025-03-14T12:17:35-04:00' });
    expect(result.last_update).toBe('2025-03-14T12:17:35-04:00');
  });

  it('projects the delivered history with state-zone timestamps', () => {
    const result = parseUSPSTrackingHtml(DELIVERED_PAGE, DELIVERED_NUMBER);
    expect(result).toMatchObject({
      status: 'delivered',
      current_stage: 'delivered',
      last_status_text: 'Delivered',
      last_update: '2025-03-14T08:00:00-04:00',
      expected_delivery: null,
    });
    expect(result.events).toEqual([
      { time: '2025-03-14T08:00:00-04:00', location: 'WASHINGTON, DC 20212', description: 'Delivered', stage: 'delivered' },
      { time: '2025-03-14T07:00:00-04:00', location: 'WASHINGTON, DC 20212', description: 'Out for Delivery', stage: 'out_for_delivery' },
      { time: '2025-03-13T18:15:00-04:00', location: 'WASHINGTON, DC 20212', description: 'Arrived at Post Office', stage: 'ready_for_pickup' },
      { time: '2025-03-12T09:30:00-04:00', location: 'LAUREL, MD 20707', description: 'Accepted at USPS Origin Facility', stage: 'accepted' },
    ]);
  });

  it('projects an in-transit parcel with its estimate', () => {
    const result = parseUSPSTrackingHtml(IN_TRANSIT_PAGE, IN_TRANSIT_NUMBER);
    expect(result).toMatchObject({
      status: 'in_transit',
      current_stage: 'in_transit',
      last_status_text: 'In Transit to Next Facility. Expected Delivery by Monday, March 17, 2025',
      last_update: '2025-03-15T23:20:00-05:00',
      expected_delivery: '2025-03-17',
    });
    expect(result.events).toHaveLength(3);
  });

  it('keeps the signatory out of the result', () => {
    const serialized = JSON.stringify(parseUSPSTrackingHtml(DELIVERED_PAGE, DELIVERED_NUMBER));
    expect(serialized).not.toContain('PRIVATE RECIPIENT');
  });

  it('produces every capability carrier.json declares', () => {
    expect(CAPABILITIES).toEqual(['history', 'location', 'eta']);
    const result = parseUSPSTrackingHtml(DELIVERED_PAGE, DELIVERED_NUMBER);
    expect(result.events?.length).toBeGreaterThan(0);
    expect(result.events?.some((event) => event.location)).toBe(true);
    expect(parseUSPSTrackingHtml(IN_TRANSIT_PAGE, IN_TRANSIT_NUMBER).expected_delivery).toBeTruthy();
  });

  it('reports an unavailable number as unlocated and verifies the requested number', () => {
    const unavailable = DELIVERED_PAGE.replace(
      '<div class="banner-header">Delivered</div>',
      '<div class="banner-header">Tracking Not Available</div>');
    expect(parseUSPSTrackingHtml(unavailable, DELIVERED_NUMBER)).toMatchObject({
      status: 'unknown',
      events: [],
      last_status_text: 'USPS could not locate the shipment',
    });
    expect(() => parseUSPSTrackingHtml(DELIVERED_PAGE, IN_TRANSIT_NUMBER))
      .toThrow('USPS did not return the requested parcel');
    expect(() => parseUSPSTrackingHtml('<html><body>challenge shell</body></html>', DELIVERED_NUMBER))
      .toThrow('USPS challenged the browser tracking session');
  });
});

describe('USPS lookup steps', () => {
  function trawlReply(html: string, number = DELIVERED_NUMBER) {
    return Response.json({
      tier: 3,
      statusCode: 200,
      url: uspsTrackingUrl(number),
      html,
      cookies: [],
      userAgent: 'Mozilla/5.0 (test browser)',
      capturedResponses: [],
    });
  }

  it('reports the missing browser service without any request', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('must not fetch'));
    await expect(new USPSTracker({ trawl: null }).fetch(DELIVERED_NUMBER))
      .rejects.toMatchObject({
        name: 'ChallengeError',
        message: 'USPS challenged direct tracking; configure FLARESOLVERR_URL for browser fallback',
      });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('leaves the browser 45 seconds by default, so a lookup ends within a minute', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    await expect(new USPSTracker({ trawl: new TrawlClient(TRAWL_URL) }).fetch(DELIVERED_NUMBER)).rejects.toThrow();
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toMatchObject({ maxTimeout: 45_000 });
  });

  it('reads the page the browser rendered', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(trawlReply(DELIVERED_PAGE));
    const { recorder, records } = stepRecorder();

    const result = await new USPSTracker({ timeoutMs: 2_000, trawl: new TrawlClient(TRAWL_URL), recorder }).fetch(DELIVERED_NUMBER);

    expect(result).toMatchObject({
      status: 'delivered',
      tracking_source: 'rendered-page',
      tracking_url: uspsTrackingUrl(DELIVERED_NUMBER),
    });
    expect(result.events?.length ?? 0).toBeGreaterThan(1);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toMatchObject({
      url: `https://tools.usps.com/tracking/${DELIVERED_NUMBER}`,
      skipHttp: true,
      maxTier: 3,
    });
    expect(records).toEqual(['trawl:ok', 'lookup:trawl:ok']);
  });

  it('recovers one incomplete header-only page and retains the failed attempt', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(trawlReply(HEADER_ONLY_PAGE))
      .mockResolvedValueOnce(trawlReply(TIMELINE_PAGE));
    const step = vi.fn();
    const lookup = vi.fn();
    const result = await new USPSTracker({ trawl: new TrawlClient(TRAWL_URL), recorder: { step, lookup } }).fetch(DELIVERED_NUMBER);
    expect(result.events).toHaveLength(5);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(step).toHaveBeenNthCalledWith(1, expect.objectContaining({ step: 'trawl', attempt: 1,
      outcome: 'challenge', error: expect.objectContaining({ reason: 'incomplete_page' }) }));
    expect(step).toHaveBeenNthCalledWith(2, expect.objectContaining({ step: 'trawl', attempt: 2,
      outcome: 'ok', fallbackFrom: 'trawl', fallbackReason: 'challenge',
      fallbackError: expect.objectContaining({ reason: 'incomplete_page' }) }));
    expect(lookup).toHaveBeenCalledWith(expect.objectContaining({ attempts: 2, outcome: 'ok' }));
  });

  it('stops after two incomplete pages without claiming the shipment is missing', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => trawlReply(HEADER_ONLY_PAGE));
    await expect(new USPSTracker({ trawl: new TrawlClient(TRAWL_URL) }).fetch(DELIVERED_NUMBER))
      .rejects.toMatchObject({ kind: 'challenge', reason: 'incomplete_page' });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('reads once more after the tracking page head arrives without its body', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(trawlReply(HEAD_ONLY_PAGE))
      .mockResolvedValueOnce(trawlReply(TIMELINE_PAGE));
    expect((await new USPSTracker({ trawl: new TrawlClient(TRAWL_URL) }).fetch(DELIVERED_NUMBER)).events).toHaveLength(5);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(() => parseUSPSTrackingHtml(HEAD_ONLY_PAGE.replace('</head>', '</head><body><p>Access denied</p></body>'), DELIVERED_NUMBER))
      .toThrowError(expect.objectContaining({ kind: 'challenge', reason: undefined }));
  });

  it('reads once more after the verification interstitial and stops after a second one', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(trawlReply(INTERSTITIAL_PAGE))
      .mockResolvedValueOnce(trawlReply(TIMELINE_PAGE));
    const step = vi.fn();
    const result = await new USPSTracker({ trawl: new TrawlClient(TRAWL_URL), recorder: { step, lookup: vi.fn() } }).fetch(DELIVERED_NUMBER);
    expect(result.events).toHaveLength(5);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(step).toHaveBeenNthCalledWith(2, expect.objectContaining({ step: 'trawl', outcome: 'ok',
      fallbackError: expect.objectContaining({ reason: 'interstitial_page' }) }));
    fetcher.mockReset().mockImplementation(async () => trawlReply(INTERSTITIAL_PAGE));
    await expect(new USPSTracker({ trawl: new TrawlClient(TRAWL_URL) }).fetch(DELIVERED_NUMBER))
      .rejects.toMatchObject({ kind: 'challenge', reason: 'interstitial_page' });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('keeps a titled or worded page without the tracker an unrepeated challenge', () => {
    for (const page of [INTERSTITIAL_PAGE.replace('<title></title>', '<title>Access</title>'),
      INTERSTITIAL_PAGE.replace('</script>', '</script><p>Please wait</p>'), INTERSTITIAL_PAGE.replace(/<script>.*<\/script>/, '')]) {
      expect(() => parseUSPSTrackingHtml(page, DELIVERED_NUMBER)).toThrowError(expect.objectContaining({ kind: 'challenge', reason: undefined }));
    }
  });

  it('does not repeat a challenge shell, wrong identity or rate limit', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(trawlReply('<html>Browser challenge</html>'));
    const tracker = new USPSTracker({ trawl: new TrawlClient(TRAWL_URL) });
    await expect(tracker.fetch(DELIVERED_NUMBER)).rejects.toMatchObject({ kind: 'challenge' });
    expect(fetcher).toHaveBeenCalledTimes(1);
    fetcher.mockClear().mockResolvedValue(trawlReply(IN_TRANSIT_PAGE));
    await expect(tracker.fetch(DELIVERED_NUMBER)).rejects.toMatchObject({ kind: 'schema' });
    expect(fetcher).toHaveBeenCalledTimes(1);
    fetcher.mockClear().mockImplementation(async () => new Response('Rate limited', { status: 429 }));
    await expect(tracker.fetch(DELIVERED_NUMBER)).rejects.toMatchObject({ kind: 'rate_limited' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('stops recovery when the caller cancels', async () => {
    const controller = new AbortController();
    const reason = new Error('Cancelled');
    const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      controller.abort(reason);
      return trawlReply(HEADER_ONLY_PAGE);
    });
    await expect(new USPSTracker({ trawl: new TrawlClient(TRAWL_URL) }).fetch(DELIVERED_NUMBER, { signal: controller.signal }))
      .rejects.toBe(reason);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('retrieves incoming international mail under its original number and verifies the response identity', async () => {
    const number = 'LZ123456785CN';
    const html = DELIVERED_PAGE.replaceAll(DELIVERED_NUMBER, number);
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(trawlReply(html, number));
    const result = await new USPSTracker({ trawl: new TrawlClient(TRAWL_URL) }).fetch(number);
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body)).url).toBe(uspsTrackingUrl(number));
    expect(result).toMatchObject({ status: 'delivered', tracking_url: uspsTrackingUrl(number) });
    expect(result.events).toHaveLength(4);

    // A response for another country's identifier is not a verified handoff.
    fetcher.mockResolvedValueOnce(trawlReply(html.replaceAll(number, 'LZ123456785US'), number));
    await expect(new USPSTracker({ trawl: new TrawlClient(TRAWL_URL) }).fetch(number))
      .rejects.toThrow('USPS did not return the requested parcel');
  });

  it('reports the package identifier of a typed routing barcode as the canonical number', async () => {
    // An invented package identifier behind the routing prefix and a made-up ZIP code.
    const pic = '9210090000000012345679';
    const html = DELIVERED_PAGE.replaceAll(DELIVERED_NUMBER, pic);
    const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => trawlReply(html, pic));
    const tracker = new USPSTracker({ trawl: new TrawlClient(TRAWL_URL) });
    const result = await tracker.fetch(`420 00000 ${pic}`);
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body)).url).toBe(uspsTrackingUrl(pic));
    expect(result).toMatchObject({ status: 'delivered', canonical_tracking_number: pic, tracking_url: uspsTrackingUrl(pic) });
    expect(JSON.stringify(result)).not.toContain('42000000');
    // The package identifier typed on its own, spaced as printed, is already the canonical number.
    expect(await tracker.fetch('9210 0900 0000 0012 3456 79')).not.toHaveProperty('canonical_tracking_number');
  });

  it('rejects a number that is not a USPS number before any request', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('must not fetch'));
    const lookup = new USPSTracker({ trawl: new TrawlClient(TRAWL_URL) }).fetch('1Z999AA10123456784');
    await expect(lookup).rejects.toThrow('USPS tracking numbers must contain 20 or 22 digits');
    await expect(lookup).rejects.toMatchObject({ kind: 'invalid_input' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('builds the canonical tracking URL', () => {
    expect(uspsTrackingUrl(DELIVERED_NUMBER)).toBe(`https://tools.usps.com/tracking/${DELIVERED_NUMBER}`);
  });

  it.each([DELIVERED_NUMBER, '92000000000123456789012344', 'LZ123456785CN'])(
    'recognizes current and legacy links for the whole identifier %s', (number) => {
      for (const url of [uspsTrackingUrl(number), `${uspsTrackingUrl(number)}/`,
        `https://tools.usps.com/go/TrackConfirmAction?tLabels=${number}`]) {
        expect(parseTrackingInput(url)).toMatchObject({ trackingNumber: number, carrier: 'usps', confidence: 'high', source: 'link' });
      }
    },
  );

  it('does not claim a partial identifier in the tracking path', () => {
    expect(parseTrackingInput(`https://tools.usps.com/tracking/${DELIVERED_NUMBER}EXTRA`).carrier).not.toBe('usps');
  });
});
