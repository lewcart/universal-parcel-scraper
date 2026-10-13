import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { ChallengeError, IndeterminateError, InvalidInputError, NoHistoryError, NotFoundError, SchemaError } from '../../core/errors/index.js';
import { classifyAsendiaUkEvent, isAsendiaUkNotice } from './status.js';
import { AsendiaUkTracker, asendiaUkTrackingUrl, normalizeAsendiaUkTrackingNumber, parseAsendiaUkTrackingPage } from './uk.js';

// Every value in the fixtures is synthetic.
const NUMBER = 'SYNTHETICUK0000001';

function fixture(name: string): string {
  return readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8');
}

const delivered = () => fixture('uk-delivered.html');
const notFound = () => fixture('uk-not-found.html');

/** The delivered page with only the history rows chosen (newest first). */
function withHistory(rows: Array<[string, string]>): string {
  const page = delivered();
  const start = page.indexOf('<tr>', page.indexOf('<th class="history-right"'));
  const end = page.indexOf('</tbody>', start);
  const history = rows.map(([description, date]) => `<tr><td class="history-left"><span class="history-data"></span></td>`
    + `<td class="history-left"><span class="history-data">${description}</span></td>`
    + `<td class="history-right"><span class="history-data">${date} </span></td></tr>`).join('\n');
  return page.slice(0, start) + history + page.slice(end);
}

describe('Asendia UK tracking numbers and links', () => {
  it('normalizes typed input and builds the tracker link', () => {
    expect(normalizeAsendiaUkTrackingNumber(' synthetic-uk 0000001 ')).toBe('SYNTHETICUK0000001');
    expect(asendiaUkTrackingUrl(NUMBER)).toBe(`https://uktracking.asendia.com/tracking.php?ref=${NUMBER}&submit=`);
    for (const invalid of ['AB12', '', 'x'.repeat(41)]) {
      expect(() => normalizeAsendiaUkTrackingNumber(invalid)).toThrow(InvalidInputError);
    }
  });
});

describe('Asendia UK page projection', () => {
  it('keeps wall clocks in page order and names the delivering post', () => {
    const result = parseAsendiaUkTrackingPage(delivered(), NUMBER);
    expect(result).toMatchObject({
      status: 'delivered',
      current_stage: 'delivered',
      last_status_text: 'Delivered',
      last_update: null,
      last_update_local: '2026-09-21T09:37:00',
      expected_delivery: null,
      destination_country: 'FR',
      delivery_carrier: 'la-poste',
    });
    expect(result.delivery_tracking_number).toBeUndefined();
    // The exact duplicate is dropped; the same scan an hour apart is kept.
    expect(result.events).toHaveLength(12);
    expect(result.events?.slice(0, 2)).toEqual([
      { local_time: '2026-09-21T09:37:00', description: 'Delivered', stage: 'delivered' },
      { local_time: '2026-09-21T05:25:00', description: 'Out for delivery', stage: 'out_for_delivery' },
    ]);
    expect(result.events?.filter((event) => event.description === 'Customs cleared').map((event) => event.local_time))
      .toEqual(['2026-09-18T10:43:00', '2026-09-18T09:43:00']);
    expect(result.events?.at(-1)).toEqual({ local_time: '2026-09-14T15:01:00', description: 'Manifest received', stage: 'registered' });
    expect(result.events?.every((event) => event.time === undefined)).toBe(true);
    // Notices keep no stage.
    expect(result.events?.find((event) => event.description === 'Information')?.stage).toBeUndefined();
    expect(result.events?.find((event) => event.description === 'Carrier delays')?.stage).toBeUndefined();
  });

  it('keeps the order reference, city, region and postal code out of the result', () => {
    const serialized = JSON.stringify(parseAsendiaUkTrackingPage(delivered(), NUMBER));
    for (const privateValue of ['SYNTHETICORDER0001', 'Exampleville', 'Example Region', '99999']) {
      expect(serialized).not.toContain(privateValue);
    }
  });

  it('takes the current stage from the newest scan, not a newer notice', () => {
    const result = parseAsendiaUkTrackingPage(withHistory([
      ['Information', '22:47 Tue 15 Sep 2026'],
      ['Processed down packet line', '00:01 Tue 15 Sep 2026'],
      ['Carrier delays', '15:10 Mon 14 Sep 2026'],
      ['Manifest received', '15:01 Mon 14 Sep 2026'],
    ]), NUMBER);
    expect(result).toMatchObject({
      status: 'in_transit', current_stage: 'accepted', last_status_text: 'Processed down packet line',
      last_update_local: '2026-09-15T22:47:00',
    });
  });

  it('falls back to the shared wording rules for unmapped wording', () => {
    const result = parseAsendiaUkTrackingPage(withHistory([['Returned to sender', '10:00 Mon 21 Sep 2026']]), NUMBER);
    expect(result.current_stage).toBeUndefined();
    expect(result.status).toBe('exception');
    expect(result.events?.[0]?.stage).toBeUndefined();
  });

  it('names a partner linked through Asendia\'s own portal by its label', () => {
    const page = delivered()
      .replace(/href="https:\/\/www\.laposte\.fr[^"]*"/, 'href="https://track.asendia.com/track/SYNTHETICUK0000001"')
      .replace('>COLISSIMO<', '>LAPOSTE<');
    expect(parseAsendiaUkTrackingPage(page, NUMBER).delivery_carrier).toBe('la-poste');
    const unknown = delivered().replace('>COLISSIMO<', '>SomePartner<').replace(/href="[^"]*laposte[^"]*"/, 'href="https://partner.example/track"');
    expect(parseAsendiaUkTrackingPage(unknown, NUMBER).delivery_carrier).toBeUndefined();
  });

  it('reads the explicit notice as not found', () => {
    expect(() => parseAsendiaUkTrackingPage(notFound(), NUMBER)).toThrow(NotFoundError);
  });

  it('binds the page only through the echoed tracking code', () => {
    // The search also matches order references: another code is not this parcel.
    expect(() => parseAsendiaUkTrackingPage(delivered(), 'SYNTHETICORDER0001')).toThrow(IndeterminateError);
    expect(() => parseAsendiaUkTrackingPage(delivered(), 'SYNTHETICORDER0001')).not.toThrow(NotFoundError);
    const twice = delivered().replace('<tbody><tr><td colspan="2" class="parcel"></td></tr>',
      '<tbody><tr><td colspan="2" class="parcel"></td></tr><tr><td class="parcel-left">Parcel: <b>2</b> of <b>2</b><br>Tracking Code: <b>SYNTHETICUK0000001</b></td></tr>');
    expect(() => parseAsendiaUkTrackingPage(twice, NUMBER)).toThrow(SchemaError);
  });

  it('reads a bound parcel without scans as having no history yet', () => {
    expect(() => parseAsendiaUkTrackingPage(withHistory([]), NUMBER)).toThrow(NoHistoryError);
  });

  it.each([
    ['an empty result block', notFound().replace(/<h3>No tracking information found<\/h3>/, ''), 'did not answer the search'],
    ['a page without the search form', delivered().replace('name="ref"', 'name="reference"'), 'unexpected page'],
    ['another page', '<html><body><h1>Maintenance</h1></body></html>', 'unexpected page'],
    ['a changed history table', delivered().replace('>Description<', '>Event<'), 'unexpected history table'],
    ['an invalid event date', withHistory([['Delivered', '09:37 Tue 21 Sep 2026']]), 'invalid event date'],
    ['a changed date format', withHistory([['Delivered', '2026-09-21 09:37']]), 'invalid event date'],
    ['a changed parcel block', delivered().replace('Tracking Code:', 'Tracking Number:'), 'invalid parcel'],
    ['parcels with a not-found notice', delivered().replace('<table>', '<h3>No tracking information found</h3><table>'), 'not-found notice'],
  ])('fails as schema drift on %s', (_name, page, message) => {
    expect(() => parseAsendiaUkTrackingPage(page, NUMBER)).toThrow(SchemaError);
    expect(() => parseAsendiaUkTrackingPage(page, NUMBER)).toThrow(message);
  });

  it('reports a challenge page as a challenge', () => {
    expect(() => parseAsendiaUkTrackingPage('<html><head><title>Just a moment...</title></head></html>', NUMBER)).toThrow(ChallengeError);
  });
});

describe('Asendia UK status vocabulary', () => {
  it.each([
    ['Manifest received', 'pending', 'registered'],
    ['Processed down packet line', 'in_transit', 'accepted'],
    ['Awaiting Despatch', 'in_transit', 'in_transit'],
    ['Scanned to Container', 'in_transit', 'in_transit'],
    ['Held by customs or governing body', 'in_transit', 'customs'],
    ['Customs cleared', 'in_transit', 'in_transit'],
    ['Sub-contractor received', 'in_transit', 'in_transit'],
    ['Internal Hub Scan ', 'in_transit', 'in_transit'],
    ['Out for delivery', 'out_for_delivery', 'out_for_delivery'],
    ['Delivered', 'delivered', 'delivered'],
  ])('maps %s', (description, status, stage) => {
    expect(classifyAsendiaUkEvent(description)).toEqual({ status, stage });
  });

  it('leaves notices and unknown wording unmapped', () => {
    for (const description of ['Information', 'Carrier delays', 'Delivered to neighbour']) {
      expect(classifyAsendiaUkEvent(description)).toBeNull();
    }
    expect(isAsendiaUkNotice('Information')).toBe(true);
    expect(isAsendiaUkNotice('Delivered')).toBe(false);
  });
});

describe('Asendia UK lookup', () => {
  it('asks the tracker page once with the lookup signal', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response(delivered(), { headers: { 'Content-Type': 'text/html; charset=UTF-8' } }));
    const result = await new AsendiaUkTracker({ fetcher }).fetch(NUMBER);
    expect(result).toMatchObject({
      status: 'delivered',
      tracking_source: 'rendered-page',
      tracking_url: `https://uktracking.asendia.com/tracking.php?ref=${NUMBER}&submit=`,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0]!;
    expect(String(url)).toBe(`https://uktracking.asendia.com/tracking.php?ref=${NUMBER}&submit=`);
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(new Headers(init?.headers).get('user-agent')).toBeTruthy();
  });

  it('keeps an outage and a rate limit apart from not-found', async () => {
    const outage = vi.fn<typeof fetch>(async () => new Response('', { status: 500 }));
    await expect(new AsendiaUkTracker({ fetcher: outage }).fetch(NUMBER)).rejects.toMatchObject({ name: 'UpstreamHttpError', status: 500 });
    const limited = vi.fn<typeof fetch>(async () => new Response('', { status: 429, headers: { 'Retry-After': '30' } }));
    await expect(new AsendiaUkTracker({ fetcher: limited }).fetch(NUMBER)).rejects.toMatchObject({ kind: 'rate_limited' });
  });

  it('does not start once the lookup is cancelled', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const controller = new AbortController();
    controller.abort(new Error('cancelled'));
    await expect(new AsendiaUkTracker({ fetcher }).fetch(NUMBER, { signal: controller.signal })).rejects.toThrow('cancelled');
    expect(fetcher).not.toHaveBeenCalled();
  });
});
