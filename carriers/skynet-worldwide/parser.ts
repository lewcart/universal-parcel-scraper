import { DateTime } from 'luxon';
import { normalizeTrackingNumber } from '../../core/detection/index.js';
import { ChallengeError, IndeterminateError, InvalidInputError, NoHistoryError, NotFoundError, SchemaError } from '../../core/errors/index.js';
import type { CarrierEvent, CarrierResult } from '../../core/result/index.js';
import { languageStageStatus, type Stage } from '../../core/status/index.js';
import { countryCode, countryTimeZone, firstOccurrence, regionHasTown } from '../../core/time/index.js';
import { clean, textFromHtml } from '../../core/transport/index.js';
import { skynetStage } from './status.js';

export const PROVIDER = 'SkyNet Worldwide Express';
// A long history is under 200 kB; the page carries its styles and scripts inline.
export const SKYNET_MAX_BYTES = 2_000_000;
// The tracker takes any reference and checks none; this keeps out what cannot be one.
const NUMBER = /^(?=[A-Z]*\d)[A-Z0-9]{8,20}$/;
// A run of zeros is a placeholder, not an air waybill.
const PLACEHOLDER = /^0+$/;
const MAX_ROWS = 500;

// A double-quoted JavaScript string, as the page writes each value into its script.
const LITERAL = String.raw`"((?:[^"\\\r\n]|\\.)*)"`;
// The function the server writes the history into, up to the next function.
const TRACKER = /function js_getTrack\(\)\s*\{([\s\S]*?)(?=\n\s*function \w+\s*\(|$)/;
// The tracker's own answer for a number it holds nothing for.
const NO_TRACKING = '$(".no-trackingstatus").show();';
// The panel the page shows over a shipment's history.
const SHIPMENT = '$(".trackingstatus-connote").show();';
// Each scan opens by writing the shipment's number into the page's heading.
const SHIPMENT_NUMBER = new RegExp(String.raw`\$\("\.cn"\)\.html\(${LITERAL}\);`, 'g');
const DESTINATION = new RegExp(String.raw`\$\("\.destination"\)\.html\(${LITERAL}\);`);
const WORDING = new RegExp(String.raw`langtag="event_'\s*\+\s*(\d{1,6})\s*\+\s*'">'\s*\+\s*${LITERAL}\s*\+\s*'</span>'`);
const LOCATION = new RegExp(String.raw`var TrackingLocation = ${LITERAL};`);
// A second part the page appends to the location when it has one.
const LOCATION_DETAIL = new RegExp(String.raw`TrackingLocation \+= " - " \+ ${LITERAL};`);
const DATE = /<span class="text14 t-faded-1">(\d{2} [A-Z][a-z]{2} \d{4})<\/span>/;
const CLOCK = /<span class="text14 t-faded-1 event-time">((?:0\d|1[0-2]):[0-5]\d [AP]M)<\/span>/;
// The page's own rewrite of a location such as "Lagos Others - NIGERIA" to the country alone.
const OTHERS = /(.*?) Other[s]? - (.*)/i;
// A firewall or bot check's page, which can come back with HTTP 200.
const BLOCKED = /_cf_chl_opt|cf-turnstile|<title>\s*(?:Just a moment|Attention Required|Access Denied|Request Rejected)|requested URL was rejected/i;
// Island groups an hour behind their mainland, which a location files under the country.
const ISLANDS: Readonly<Record<string, { group: string; zone: string }>> = {
  'Europe/Madrid': { group: 'ES-CN', zone: 'Atlantic/Canary' },
  'Europe/Lisbon': { group: 'PT-20', zone: 'Atlantic/Azores' },
};

/** A reference for SkyNet's tracker: eight to twenty letters and digits with at least one digit, not all zeros. */
export function normalizeSkynetNumber(raw: string): string {
  const number = raw.length <= 64 ? normalizeTrackingNumber(raw).toUpperCase() : '';
  if (!NUMBER.test(number) || PLACEHOLDER.test(number)) throw new InvalidInputError(PROVIDER, 'SkyNet air waybills are eight to twenty letters and digits');
  return number;
}

/** The text of a JavaScript string literal's body. */
function literal(body: string): string {
  return body.replace(/\\(u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|[\s\S])/g, (_, escape: string) =>
    escape.length > 1 ? String.fromCharCode(Number.parseInt(escape.slice(1), 16)) : ({ n: ' ', r: ' ', t: ' ' } as Record<string, string>)[escape] ?? escape);
}

/**
 * The zone of a scan's location, "CITY - COUNTRY" or a country alone, when the
 * country keeps one clock: Spain and Portugal take their mainland's, except for
 * a town of the Canary Islands or the Azores. Null for any other country.
 */
export function skynetScanZone(location: string): string | null {
  const parts = location.split(' - ').map((part) => part.trim()).filter(Boolean);
  const zone = parts.length ? countryTimeZone(parts.at(-1)) : null;
  const islands = zone ? ISLANDS[zone] : undefined;
  return islands && parts.length > 1 && regionHasTown(islands.group, parts[0]!) ? islands.zone : zone;
}

/**
 * A scan's clock: the day ("16 Oct 2026") and 12-hour time ("11:32 AM") of the
 * scanning station's wall clock, with no zone. It is dated in the zone of a
 * country with one clock, and kept as a wall clock anywhere else.
 */
function scanClock(date: string, time: string, zoneOf: string): Pick<CarrierEvent, 'time'> & { local_time?: string } {
  // Parsing in UTC checks the calendar fields only; no offset is assigned.
  const wall = DateTime.fromFormat(`${date} ${time}`, 'dd MMM yyyy hh:mm a', { zone: 'UTC', locale: 'en-US' });
  if (!wall.isValid) throw new SchemaError(PROVIDER, 'SkyNet returned an invalid scan time');
  const local = wall.toFormat("yyyy-MM-dd'T'HH:mm:ss");
  const zone = skynetScanZone(zoneOf);
  const instant = zone ? firstOccurrence(DateTime.fromISO(local, { zone })) : null;
  // A wall clock the zone skips when its clocks go forward stays as it was written.
  return instant?.isValid && instant.toFormat("yyyy-MM-dd'T'HH:mm:ss") === local
    ? { time: instant.toISO({ suppressMilliseconds: true }) } : { local_time: local };
}

/** One scan, from the script between one heading write and the next. */
function scanOf(segment: string): CarrierEvent {
  const worded = WORDING.exec(segment);
  const date = DATE.exec(segment)?.[1];
  const time = CLOCK.exec(segment)?.[1];
  if (!worded || !date || !time) throw new SchemaError(PROVIDER, 'SkyNet returned a scan it does not render');
  const code = worded[1]!;
  const description = textFromHtml(literal(worded[2]!), 300);
  if (!description) throw new SchemaError(PROVIDER, 'SkyNet returned a scan without wording');
  const place = textFromHtml(literal(LOCATION.exec(segment)?.[1] ?? ''), 120);
  const detail = textFromHtml(literal(LOCATION_DETAIL.exec(segment)?.[1] ?? ''), 120);
  const located = place && detail ? `${place} - ${detail}` : place;
  const others = OTHERS.exec(located);
  const location = others ? clean(others[2]) : located;
  const staged = skynetStage(code, description);
  return {
    ...scanClock(date, time, place),
    ...(location ? { location } : {}),
    description,
    provider_code: code,
    ...(staged ? { stage: staged.stage, stage_source: staged.source } : {}),
  };
}

/** The country at the end of the shipment's destination, "MISSISSAUGA CANADA"; the town is not kept. */
function destinationCountry(script: string): string | null {
  const words = textFromHtml(literal(DESTINATION.exec(script)?.[1] ?? ''), 120).split(' ');
  for (let count = Math.min(4, words.length); count > 0; count--) {
    const code = countryCode(words.slice(-count).join(' '));
    if (code) return code;
  }
  return null;
}

/**
 * The tracker's page for one air waybill, `go/plm-tracking?stid=skynet&cn=`.
 * The server writes the history into the page's script: for each scan the
 * shipment's number, the event's wording and number, its location and its
 * clock, newest first. Each scan must name the number asked. A number the
 * tracker holds nothing for comes back with its "no tracking" notice.
 */
export function parseSkynet(html: string, rawNumber: string): CarrierResult {
  const number = normalizeSkynetNumber(rawNumber);
  const script = TRACKER.exec(html)?.[1];
  if (script === undefined) {
    if (BLOCKED.test(html.slice(0, 64_000))) throw new ChallengeError(PROVIDER, 'SkyNet answered with a block page');
    throw new SchemaError(PROVIDER, 'SkyNet did not return its tracking page');
  }
  const heads = [...script.matchAll(SHIPMENT_NUMBER)];
  if (!heads.length) {
    if (script.includes(NO_TRACKING)) throw new NotFoundError(PROVIDER);
    if (script.includes(SHIPMENT)) throw new NoHistoryError(PROVIDER);
    throw new SchemaError(PROVIDER, 'SkyNet returned a page without an answer');
  }
  if (script.includes(NO_TRACKING)) throw new SchemaError(PROVIDER, 'SkyNet returned scans with its no-tracking notice');
  if (heads.length > MAX_ROWS) throw new SchemaError(PROVIDER, 'SkyNet returned an oversized history');
  if (heads.some((head) => normalizeTrackingNumber(literal(head[1]!)).toUpperCase() !== number)) {
    throw new IndeterminateError(PROVIDER, 'SkyNet answered for another shipment');
  }
  const events = heads.map((head, index) => scanOf(script.slice(head.index, heads[index + 1]?.index)));
  const newest = events[0]!;
  // A notice has no stage; the newest scan with one sets the parcel's.
  const current = events.find((event) => event.stage);
  const stage = current?.stage as Stage | undefined;
  const country = destinationCountry(script);
  return {
    status: stage ? languageStageStatus(stage) : 'unknown',
    ...(stage ? { current_stage: stage, current_stage_source: current!.stage_source } : {}),
    last_status_text: newest.description!,
    last_update: newest.time ?? null,
    ...(newest.local_time ? { last_update_local: newest.local_time } : {}),
    expected_delivery: null,
    ...(country ? { destination_country: country } : {}),
    events,
  };
}
