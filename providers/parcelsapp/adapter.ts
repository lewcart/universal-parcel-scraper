
/**
 * ParcelsApp (parcelsapp.com), a universal aggregator used as the second
 * discovery provider.
 *
 * Transport: a scoped anonymous POST reproduces the public frontend checksum
 * and submits the stored delivery postcode. Browser capture remains recovery
 * for protocol challenges. Numberless direct replies belong to their single
 * POST; captured replies still require the rendered result's identity.
 */
import { load } from 'cheerio';
import { DateTime } from 'luxon';
import timers from 'node:timers/promises';
import type { AdapterFactory } from '../../core/adapter/index.js';
import { isPostiAbroadLabel } from '../../carriers/posti/identity.js';
import { carrierTimezone } from '../../core/catalog/index.js';
import { brandTimeZones, carrierBrand, carrierIdFromName, carrierNameCountryZone } from '../../core/catalog/hints.js';
import { CarrierError, carrierErrorKind, ChallengeError, IndeterminateError, InputRequiredError, NoHistoryError, SchemaError, UpstreamHttpError, UpstreamNetworkError } from '../../core/errors/index.js';
import { runSteps } from '../../core/runner/index.js';
import type { CarrierEvent, CarrierResult } from '../../core/result/index.js';
import type { StepRecorder } from '../../core/telemetry/index.js';
import {
  canadaProvinceTimeZone, countryCode, countryTimeZone, mislabeledLocalTime, mislabeledWallTime, regionHasTown, sharedClockZone,
  timeZoneCountry, usStateTimeZone,
} from '../../core/time/index.js';
import type { TrawlClient } from '../../core/transport/index.js';
import { isRecord } from '../../core/types.js';
import { capturedBodies, loadCapture, type CaptureSpec } from '../shared/capture.js';
import { facilityZone, LatestScan, relaysFacilityClock } from '../shared/facilityClock.js';
import { brandCarrierForNumber, universalCarrierHints } from '../shared/hints.js';
import { event, isNotice, localEvent, numberOf, result, type UniversalSource } from '../shared/result.js';
import { carrierScan, markReturnLeg, type CarrierScan } from '../shared/scans.js';
import { PARCELSAPP_API, ParcelsAppHttpClient } from './http.js';

const SOURCE: UniversalSource = 'ParcelsApp';
const MAX_EVENTS = 1000;
export const PARCELSAPP_BUDGET_MS = 45_000;
const DIRECT_BUDGET_MS = 30_000;
const RETRY_DELAY_MS = 2_000;

// ParcelsApp's response omits the number. Bind it to the rendered result's
// tracking-number row, never merely to the input field or the requested URL.
function parcelsIdentity(html: string, number: string): boolean {
  const $ = load(html);
  const rows = $('.tracking-info .parcel .parcel-attributes tr').filter((_, row) =>
    $(row).children('td').first().text().trim() === 'Tracking number');
  return rows.length === 1 && rows.first().children('td').eq(1).text().trim() === number;
}

export function parseParcelsAppResponse(payload: unknown, trackingNumber: string, html: string, timezone: string | null = null): CarrierResult {
  if (!parcelsIdentity(html, numberOf(trackingNumber))) throw new SchemaError(SOURCE, 'ParcelsApp shipment identity missing');
  return parseHistory(payload, trackingNumber, timezone);
}

/**
 * ParcelsApp's `date` is the scan's local clock, labeled as UTC or shifted
 * into an offset of its own: a DPD scan at 14:05+02:00 arrives as
 * "14:05+00:00", a Swiss Post delivery at 11:30 local as "13:30+02:00"
 * (both shapes checked 2026-09-22). Its UTC digits are re-read in the zone
 * of the scan's carrier, else its location's country, else the country the
 * carrier name ends with ("DPD UK"), else, for a scan with no location, the
 * clock that all catalog networks of a bare brand share at that moment ("DPD
 * Group": DPD Switzerland and France), else the zone routing passes for the
 * parcel. Without one it stays as labeled, as it does when the name's
 * country or the parcel's zone meets a location in another country. TNT's
 * international scans stay as labeled too: tnt.com gives them offsets, and
 * ParcelsApp's UTC matches them. So do Asendia USA's, wherever they happened:
 * their dates are the UTC instants of Asendia's A1 feed, and Swiss Post's own
 * scans of the same item agree (checked 2026-09-30). So do Paack's: its
 * timeline gives instants, and Paack's own lookup has ParcelsApp's UTC scan
 * for scan (checked 2026-10-07).
 */
function stateCarrierName(payload: Record<string, unknown>, state: Record<string, unknown>): unknown {
  const carriers = Array.isArray(payload.carriers) ? payload.carriers : [];
  return typeof state.carrier === 'number' ? carriers[state.carrier] : undefined;
}

// The names ParcelsApp gives Asendia USA's scans.
const ASENDIA_USA = /^asendia\s+(?:usa|united\s+states)$/i;
/** A carrier name as the tables below key it: "GoFo Express" is "gofoexpress". */
const nameKey = (name: unknown) => typeof name === 'string' ? name.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
// Carriers whose ParcelsApp dates are a North American scan's local clock:
// UPS's own instants, FedEx's own page, UniUni's own feed and Ship24's offsets
// agree once they are read that way (checked 2026-09-30 on US scans; UPS's
// also in Germany, the Netherlands and Spain). So does DHL eCommerce's
// Webtrack, which names each scan's clock, on all 25 scans of three parcels
// in seven states and the UK (2026-10-11). OnTrac's are UTC and Landmark's
// keep one clock everywhere, so no other carrier gets this step beyond the
// ones below.
const LOCAL_CLOCK_CARRIERS = new Set(['ups', 'fedex', 'uniuni', 'uniexpress', 'easyship', 'dhlecommerce']);
/**
 * Carriers whose dates are each scan's local clock under a label that is
 * never its instant, checked scan for scan on 2026-10-10: USPS's own page,
 * and the "at 8:25 am" ParcelsApp relays in its text; Canada Post's digits;
 * GOFO's US feed, which gives the offsets; Orange Connex's times and offsets
 * for SpeedPAK; the EMS office clocks Parcelforce and NZ Post relay; Cainiao's
 * leg by leg, on GMT+8, +2 or +1, also under EcoScooting; and 4PX's (below).
 * They are read in the state, province or single-clock country their location
 * names; `wallClockZones` reads the others.
 */
const WALL_CLOCKS = new Set(['usps', 'canadapost', 'gofoexpress', 'speedpak', 'ems', 'cainiao', 'ecoscooting', '4pxexpress']);
// A known clock that is the destination country's (`knownClock`).
const DESTINATION = 'destination';
const wordings = (list: readonly string[]) => new RegExp(`^(?:${list.join('|')})$`, 'i');
// Cainiao's last-mile scans, in its words or the local carrier's.
const CAINIAO_LAST_MILE = [
  'received by local\\s+delivery company', '(?:at|left) destination country/region(?: sorting center)?', 'arrived at local delivery center',
  'out for delivery', 'delivery failed(?:\\. not at home\\.)?', 'delivery attempt failure,.*', '(?:item )?delivered',
  'parcel is handled', 'your shipment has been delivered to the postal operator of the country.*',
];
/**
 * The clocks of some wall-clock scans whatever their neighbours', from each
 * carrier's own offsets. GOFO's feed dates its labels on Pacific time
 * wherever the parcel is injected (a Florida parcel's at -07:00; 2026-10-10).
 *
 * Cainiao's own feed (checked 2026-10-11 on parcels to the UK, Belgium,
 * Spain, Italy, Japan, Brazil and the US) dates its origin leg on China time,
 * from the warehouse to the departing linehaul, and the return warehouse
 * too. It dates import customs on the destination's clock, and the last mile
 * as well, except the UK's, on GMT in July. Its transit hub, on GMT+2 for a
 * UK parcel, and "Arrived at linehaul office", on either side's clock, are
 * not listed; that office stays on China time, as it was checked first.
 *
 * 4PX's page (2026-10-11, two parcels to the US) dates its scans up to the
 * departing flight on China time and the rest in the US. EcoScooting's own
 * instants (two parcels) put its China leg on China time, its order and its
 * Spanish sorting center on Madrid's, and its last mile on the destination's:
 * Lisbon's for a "CNPRT" reference, otherwise Spain's.
 *
 * A scan on a fixed clock borrows no neighbour's: borrowed from a GOFO
 * parcel's Florida scans, the label came 3 hours early and Cainiao's "Order
 * received" 12 hours after it, 19 seconds on China time. One in the
 * destination borrows only from a scan placed there, and otherwise takes its
 * single clock (`wallClockZones`).
 */
const KNOWN_CLOCKS: ReadonlyMap<string, readonly { wording: RegExp; zone: string; except?: string; otherwise?: string }[]> = new Map([
  ['gofoexpress', [{ wording: /^shipping label created$/i, zone: 'America/Los_Angeles' }]],
  ['cainiao', [
    { wording: wordings([
      'order received successfully', 'package finished', 'leave the warehouse', 'departed from warehouse', 'accepted by carrier',
      '(?:inbound|outbound) in sorting center', 'package (?:received by|left) sorting center of transit', 'last-mile delivery forecast',
      'arrived at departure transport hub', 'export customs clearance started', 'export clearance success',
      '(?:leaving|left) from departure country/region', 'arrived at linehaul office', 'cross-solution reroute', '质检真假鉴定',
      'return warehouse inbound success\\.?', 'parcel has been destroyed in return warehouse\\.?',
    ]), zone: 'Asia/Shanghai' },
    { wording: wordings(['import clearance start', 'import customs clearance complete', 'arrived at customs', 'leaving customs',
      'we\'re inspecting your order']), zone: DESTINATION },
    { wording: wordings(CAINIAO_LAST_MILE), zone: DESTINATION, except: 'GB' },
  ]],
  ['4pxexpress', [
    { wording: wordings(['parcel information received', 'pickup scanned, in transit to warehouse', 'shipment picked up\\.?',
      'shipment arrived at facility and measured\\.?', 'depart from facility to service provider\\.?', 'hand over to airline\\.?',
      'departure from the original airport']), zone: 'Asia/Shanghai' },
    { wording: wordings(['arrival to the destination airport', 'arrived at warehouse', 'released from customs: customs cleared\\.?',
      'customs clearance agent received the shipment in destnation country\\.?', 'in transit, it\'s progressing through post network',
      'handed over to last mile']), zone: DESTINATION },
  ]],
  ['ecoscooting', [
    { wording: /^(?:shipment data information received|shipment has left cainiao express's partner facility|shipment is in transit to cainiao express)$/i,
      zone: 'Asia/Shanghai' },
    { wording: /^(?:create|sorting center (?:inbound|outbound))\./i, zone: 'Europe/Madrid' },
    { wording: /^(?:accepted by last mile|out for delivery|delivery attempt failure|delivery success|pudo inbound success|delivered to pudo)\./i,
      zone: DESTINATION, otherwise: 'Europe/Madrid' },
  ]],
]);

/**
 * A scan's known clock: its zone, null when the destination has several, and
 * for a scan in the destination, that country.
 */
function knownClock(name: unknown, status: string, destination: string | null): { zone: string | null; country?: string } | null {
  const known = KNOWN_CLOCKS.get(nameKey(name))?.find(({ wording }) => wording.test(status.trim()));
  if (!known || known.zone !== DESTINATION) return known ? { zone: known.zone } : null;
  if (!destination) return known.otherwise ? { zone: known.otherwise } : null;
  return destination === known.except ? null : { zone: countryTimeZone(destination), country: destination };
}
/**
 * Networks whose dates are their home clock wherever the scan was: their own
 * instants or labels shown on that clock, checked on 2026-10-10. Italy Post's
 * are Poste Italiane's epoch milliseconds on Rome time. New Zealand Post's
 * are NZ Post's UTC instants on Auckland time, also for the scans it relays
 * from abroad ("Hong Kong"). Singapore Post's are SingPost's "+08:00" digits,
 * also for its scans in China, and SunYou's those of its "+08:00" feed.
 */
const HOME_CLOCKS: Readonly<Record<string, string>> = {
  italypost: 'Europe/Rome', newzealandpost: 'Pacific/Auckland', singaporepost: 'Asia/Singapore', sunyousytrack: 'Asia/Shanghai',
};
/**
 * Networks whose dates are their scans' local clocks, checked at home only
 * (2026-10-10): Korea Post's page, Bring's offsets (in Denmark too) and
 * Parcelforce's for Royal Mail; Japan Post's, which its portal gives as local
 * times, at 10:27 for a delivery in Japan that Cainiao dates 10:27 GMT+9 and
 * Ship24 01:27Z (2026-10-11). Pekaes' are the offset-less digits its own
 * history gives and its page labels Polish time (2026-10-13). Their home
 * clock is a guess, which a location in another country rules out.
 */
const HOME_COUNTRIES: Readonly<Record<string, string>> = {
  southkoreapost: 'Asia/Seoul', postennorgenorwaypost: 'Europe/Oslo', royalmail: 'Europe/London', japanpost: 'Asia/Tokyo',
  pekaes: 'Europe/Warsaw',
};
const UNITED_STATES = /^(?:us|usa|united states(?: of america)?)$/i;
const POSTAL_CODE = /\s*\b(?:\d{5}(?:-\d{4})?|[A-Z]\d[A-Z] ?\d[A-Z]\d)$/i;
// USPS facilities: "EXAMPLE CITY IL DISTRIBUTION CENTER", "ISC EXAMPLE CITY IL (USPS)".
const US_FACILITY = /\s+(?:\(USPS\)|(?:(?:NETWORK|REGIONAL|INTERNATIONAL)\s+)?DISTRIBUTION\s+CENTER)$/i;
// States written out, as Orange Connex does for SpeedPAK ("Example City Minnesota, United States").
const US_STATE_NAMES: ReadonlyMap<string, string> = new Map(Object.entries({
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA', colorado: 'CO', connecticut: 'CT',
  delaware: 'DE', districtofcolumbia: 'DC', florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID', illinois: 'IL',
  indiana: 'IN', iowa: 'IA', kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD',
  massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS', missouri: 'MO', montana: 'MT',
  nebraska: 'NE', nevada: 'NV', newhampshire: 'NH', newjersey: 'NJ', newmexico: 'NM', newyork: 'NY',
  northcarolina: 'NC', northdakota: 'ND', ohio: 'OH', oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA',
  rhodeisland: 'RI', southcarolina: 'SC', southdakota: 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT',
  vermont: 'VT', virginia: 'VA', washington: 'WA', westvirginia: 'WV', wisconsin: 'WI', wyoming: 'WY',
}));

/**
 * The zone of the US state or Canadian province a location names ("Riverside,
 * CA, US", "Charlotte, NC", "Linden, NJ 12345", "Scranton PA", "Mississauga,
 * ON, CA", "Example City, IN, US 12345"). It is `certain` when the location
 * names the country, the code is no country's, or the town lies in that state
 * or province ("Chicago, IL" is not in Israel); "Atlanta, GA" could still be
 * in Gabon. A state written out counts only after the country ("Example City
 * Minnesota, United States"): Georgia is a country too.
 */
function regionClock(location: string): { zone: string; certain: boolean } | null {
  const parts = location.split(',').map((part) => part.trim()).filter(Boolean);
  const last = parts.at(-1) ?? '';
  // "CA" after a province is Canada; after a town it is California.
  const country = parts.length > 1 && UNITED_STATES.test(last.replace(POSTAL_CODE, '')) ? 'US'
    : (parts.length > 1 && /^canada$/i.test(last)) || (parts.length > 2 && /^ca$/i.test(last)) ? 'CA' : null;
  if (country) parts.pop();
  if (parts.length > 1 && !parts.at(-1)!.replace(POSTAL_CODE, '')) parts.pop();
  // "Example City, BE, NL": a region, then some other country.
  if (!country && parts.length > 2 && parts.slice(-2).every((part) => /^[A-Z]{2}$/i.test(part))) return null;
  const words = (parts.at(-1) ?? '').replace(POSTAL_CODE, '').replace(US_FACILITY, '').split(/\s+/);
  if (country === 'US') {
    const size = [3, 2, 1].find((count) => words.length >= count && US_STATE_NAMES.has(nameKey(words.slice(-count).join(''))));
    if (size) return { zone: usStateTimeZone(US_STATE_NAMES.get(nameKey(words.slice(-size).join(''))))!, certain: true };
  }
  const code = parts.length > 1 || words.length > 1 ? words.at(-1)! : '';
  const town = parts.length > 1 ? parts.at(-2)! : words.slice(0, -1).join(' ');
  const zone = (country === 'CA' ? null : usStateTimeZone(code)) ?? (country === 'US' ? null : canadaProvinceTimeZone(code));
  return zone ? { zone, certain: country !== null || !countryCode(code) || regionHasTown(code, town) } : null;
}

/**
 * The last part of a location that is not a bare postcode: "Example Town,
 * Denmark, 4600" is in Denmark. Orange Connex names China and the United
 * States in full for SpeedPAK, Canada Post writes "USA", 4PX "US 12345", and
 * Hong Kong is not the name Intl gives it.
 */
function lastPlace(location: string): string | undefined {
  const place = location.split(',').map((part) => part.trim()).filter((part) => part && !/^\d[\d\s-]*$/.test(part)).at(-1);
  if (!place) return place;
  return /^people['’]?s republic of china$/i.test(place) ? 'CN' : UNITED_STATES.test(place.replace(POSTAL_CODE, '')) ? 'US'
    : /^hong\s*kong$/i.test(place) ? 'HK' : place;
}

/**
 * A scan's location as the zone steps read it. 4PX writes the country, state
 * and town in fixed fields ("US  NY  EXAMPLE CITY 12345", "US    EXAMPLE CITY
 * NY DISTRIBUTION CENTER"), read here as "EXAMPLE CITY 12345, NY, US".
 */
function scanLocation(name: unknown, location: unknown): string {
  const text = typeof location === 'string' ? location.trim() : '';
  if (nameKey(name) !== '4pxexpress' || !/^[A-Z]{2}(?:\s{2}|$)/.test(text)) return text;
  const [country, ...fields] = text.split(/\s{2}/).map((field) => field.trim());
  return [...fields.reverse(), country].filter(Boolean).join(', ');
}

// The countries of the US and Canadian zones a state or province gives.
const NORTH_AMERICAN_ZONES: ReadonlyMap<string, string> = new Map([
  ...[...US_STATE_NAMES.values()].map((code) => [usStateTimeZone(code)!, 'US'] as const),
  ...['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'].map((code) => [canadaProvinceTimeZone(code)!, 'CA'] as const),
]);

/**
 * A guessed zone, unless the location names a country it is not in: a guess
 * cannot put a scan in "Example City, South Africa" on Paris time. Guesses
 * from the name or from routing are single-clock countries' zones, so a
 * location in the US or Canada rules them out too. A borrowed zone can be a
 * state's or a province's, and must then be in the country the location names.
 */
function fitsPlace(zone: string | null, location: string, borrowed = false): string | null {
  const country = countryCode(lastPlace(location));
  const zoneCountry = zone ? timeZoneCountry(zone) ?? (borrowed ? NORTH_AMERICAN_ZONES.get(zone) : undefined) : undefined;
  return zone && (!country || zoneCountry === country) ? zone : null;
}

/** Where a location puts a scan, for the reply-wide North America check. */
function placeKind(location: string): 'certain' | 'region' | 'abroad' | null {
  const region = regionClock(location);
  if (region?.certain) return 'certain';
  const place = lastPlace(location);
  if (countryTimeZone(place)) return 'abroad';
  if (region) return 'region';
  const country = countryCode(place);
  return country && country !== 'US' && country !== 'CA' ? 'abroad' : null;
}

/**
 * The state or province of a North American scan from a carrier whose dates
 * are local clocks. An uncertain one counts only in a reply that is in North
 * America.
 */
function regionScanZone(name: unknown, location: string, inNorthAmerica: boolean): { zone: string; certain: boolean } | null {
  const key = nameKey(name);
  const region = LOCAL_CLOCK_CARRIERS.has(key) || WALL_CLOCKS.has(key) ? regionClock(location) : null;
  return region && (region.certain || inNorthAmerica) ? region : null;
}

/**
 * The offset of a GOFO scan that carries one of its own: GOFO France's feed
 * gives the same instants, "+02:00" in summer (checked 2026-10-10). Its US
 * scans come labeled UTC, on their local clock.
 */
function ownOffset(name: unknown, date: unknown): string | null {
  const offset = nameKey(name) === 'gofoexpress' && typeof date === 'string' ? /[+-]\d{2}:\d{2}$/.exec(date.trim())?.[0] : undefined;
  return offset && !/^[+-]00:00$/.test(offset) ? offset : null;
}

/**
 * The clock of the number's own network of a brand, when a country-qualified
 * name gives another: the depot prefix of a DPD UK number outweighs "DPD
 * France", the network ParcelsApp asked (checked 2026-10-10: DPD UK's own
 * page, Ship24 and 17TRACK put such scans on London time).
 */
function numberNetworkZone(carrier: string | undefined, number: string): string | null {
  const brand = carrier ? carrierBrand(carrier) : undefined;
  const own = brand ? brandCarrierForNumber(brand, number) : undefined;
  const zone = own && own !== carrier ? carrierTimezone(own) : 'UTC';
  return zone === 'UTC' ? null : zone;
}

/**
 * The zone a scan's carrier or place gives it: null for a date that is its
 * instant, or a DHL Express facility the rule cannot place, and undefined for
 * a scan only a guess can place (`guessedZone`).
 */
function placedZone(payload: Record<string, unknown>, state: Record<string, unknown>, number: string, inNorthAmerica = false): string | null | undefined {
  const name = stateCarrierName(payload, state);
  const key = nameKey(name);
  const carrier = typeof name === 'string' ? carrierIdFromName(name) : undefined;
  if (carrier === 'tnt' && /^\d{9}$/.test(number)) return null;
  if (typeof name === 'string' && ASENDIA_USA.test(name.trim())) return null;
  if (carrier === 'paack' || ownOffset(name, state.date)) return null;
  if (Object.hasOwn(HOME_CLOCKS, key)) return HOME_CLOCKS[key]!;
  // A home clock stays a guess that a location abroad rules out, even when
  // the catalog gives the network that zone (GEODIS Poland for "Pekaes").
  const zone = carrier && !Object.hasOwn(HOME_COUNTRIES, key) ? carrierTimezone(carrier) : 'UTC';
  // A country-qualified routing name can identify a branch rather than the
  // scan location. Keep its clock as a guess even when the alias is catalogued.
  if (zone !== 'UTC' && !(typeof name === 'string' && carrierNameCountryZone(name))) return zone;
  const location = scanLocation(name, state.location);
  // A facility's clock, whatever the label: no other step applies to it.
  if (relaysFacilityClock(name)) return facilityZone(location);
  const place = lastPlace(location);
  // A state or province the town confirms beats the country its code also
  // names ("Chicago, IL"); a merely possible one comes after ("Koeln, DE").
  const region = regionScanZone(name, location, inNorthAmerica);
  if (region?.certain) return region.zone;
  const located = countryTimeZone(place);
  if (located) return located;
  if (region) return region.zone;
  return undefined;
}

function guessedZone(payload: Record<string, unknown>, state: Record<string, unknown>, fallback: string | null, number: string): string | null {
  const name = stateCarrierName(payload, state);
  const key = nameKey(name);
  const carrier = typeof name === 'string' ? carrierIdFromName(name) : undefined;
  const location = scanLocation(name, state.location);
  // The zones below only guess where the scan was. A location in another
  // country, one with several clocks or none listed ("Example City, CA,
  // United States", "Example City, South Africa"), rules a guess out, and the
  // scan keeps its labeled instant.
  const guess = (candidate: string | null) => fitsPlace(candidate, location);
  if (typeof name !== 'string') return guess(fallback);
  const nameZone = carrierNameCountryZone(name);
  const named = guess((nameZone && numberNetworkZone(carrier, number)) || nameZone || (HOME_COUNTRIES[key] ?? null));
  if (named) return named;
  // A location with no single-clock country ("Toronto, ON", "Chicago, US")
  // can be a network of the brand outside the catalog, on another clock.
  const brand = location ? [] : brandTimeZones(name);
  const wall = brand.length ? mislabeledWallTime(state.date) : null;
  return (wall ? sharedClockZone(brand, wall) : null) ?? guess(fallback);
}

/**
 * ParcelsApp relays 4PX's feed two ways (checked 2026-10-11 against 4PX's
 * page, which shows each scan's wall clock with the offset of its place).
 * Where it keeps 4PX's fixed fields ("US  NY  EXAMPLE CITY 12345", "CN"), its
 * dates are the feed's instants, which read every wall clock on China time,
 * the US ones too: the wall clock is the instant's digits in Shanghai. Where
 * it rewrites them ("United States" for "US", "Hong Kong" for "HONG KONG -
 * HONG KONG"), they are the wall clocks themselves, labeled UTC, as other
 * carriers' are.
 */
const FOUR_PX_FIELDS = /^[A-Z]{2}(?:\s{2}|$)/;

/** Whether a reply's 4PX dates are instants: unless its 4PX scans have places, none in 4PX's fields. */
function fourPxInstants(payload: Record<string, unknown>, states: readonly unknown[]): boolean {
  const places = states.flatMap((raw) => isRecord(raw) && nameKey(stateCarrierName(payload, raw)) === '4pxexpress'
    && typeof raw.location === 'string' && raw.location.trim() ? [raw.location.trim()] : []);
  return !places.length || places.some((place) => FOUR_PX_FIELDS.test(place));
}

/**
 * A state's date as its wall clock: 4PX's instants as their Shanghai digits.
 * An instant is right only for a scan on China time, which is how a scan
 * nothing places reads when it keeps its label.
 */
function stateDate(name: unknown, date: unknown, instants = true): unknown {
  if (nameKey(name) !== '4pxexpress' || typeof date !== 'string' || !instants) return date;
  const instant = DateTime.fromISO(date.trim(), { setZone: true });
  return instant.isValid && /(?:Z|[+-]\d{2}:\d{2})$/i.test(date.trim())
    ? `${instant.setZone('Asia/Shanghai').toISO({ includeOffset: false })}Z` : date;
}

/**
 * How to read a state: its date (4PX's wall clock) and ParcelsApp's labeled
 * one, the zone its carrier or place gives (with the guesses of steps 3 to 5
 * for a network that is not a wall clock), whether its state or province
 * gave it, and for a wall-clock scan, routing's zone and any known clock,
 * which `wallClockZones` falls back on.
 */
function readState(payload: Record<string, unknown>, raw: Record<string, unknown>, status: string, fallback: string | null, number: string,
  inNorthAmerica = false, destination: string | null = null, instants = true) {
  const name = stateCarrierName(payload, raw);
  const state = { ...raw, date: stateDate(name, raw.date, instants) };
  const location = scanLocation(name, raw.location);
  const offset = ownOffset(name, state.date);
  const wallClock = WALL_CLOCKS.has(nameKey(name)) && !offset;
  const placed = placedZone(payload, state, number, inNorthAmerica);
  const zone = placed !== undefined ? placed : wallClock ? null : guessedZone(payload, state, fallback, number);
  const known = wallClock ? knownClock(name, status, destination) : null;
  // A local clock that nothing places, in the US or Canada alone ("US 12345").
  const country = countryCode(lastPlace(location));
  const nationwide = placed === undefined && zone === null && LOCAL_CLOCK_CARRIERS.has(nameKey(name)) && (country === 'US' || country === 'CA');
  return { name, date: state.date, labeled: raw.date, zone, placed: placed ?? null, offset, location, wallClock, nationwide,
    local: zone !== null && zone === regionScanZone(name, location, inNorthAmerica)?.zone,
    fallback: wallClock ? fitsPlace(fallback, location) : null, known: known?.zone ?? null, arrival: known?.country ?? null };
}

type ZoneStep = 'carrier' | 'place' | 'copy' | 'borrowed' | 'routing' | 'known' | 'labeled';

/**
 * The zone of each scan. One from a network that is not a wall clock keeps
 * the one it has. A wall-clock scan takes, in order:
 * 1. the zone of its place;
 * 2. that of another carrier's placed scan with the same digits and wording,
 *    which it copies (`copy`);
 * 3. as a guess, that of the scan of its network just before it by wall
 *    clock that steps 1 and 2 place, else of the one just after it; for a
 *    scan in the destination, only of one placed there;
 * 4. the zone routing passes for the parcel;
 * 5. its known clock (`KNOWN_CLOCKS`): a fixed one, for a scan that skips
 *    step 3, or the destination's single clock;
 * 6. none: it keeps ParcelsApp's label, as it did before these steps, the
 *    last guess.
 * A zone the scan's location rules out is skipped ("USA" takes no Canadian
 * zone). Step 3 holds when the scan happens where its neighbours do, and is
 * hours off when it does not. Checked on 2026-10-10 against the carriers'
 * own clocks: Canada Post's first scan and one in Chicago took the right
 * zone, and its last two, in Montana, the Chicago hub's, an hour off USPS's.
 * SpeedPAK's four took the right one, and a Chinese system event the US one,
 * 14 hours off. USPS's "In Transit to Next Facility" was not checked: no
 * source gives its clock. 4PX's scans between the departing flight and the
 * first US scan took China's until they were known to be in the destination
 * (2026-10-11); its US scans with no state take the right zone, or one an
 * hour off when the parcel changed zones around them.
 *
 * A scan of a carrier with local clocks (`LOCAL_CLOCK_CARRIERS`) that its
 * location places only in the US or Canada borrows as in step 3, from a scan
 * of its network that a place gives a zone, and otherwise keeps its label.
 * FedEx's "Shipment information sent to FedEx" under the shipper's ZIP code
 * took the zone of the pickup's state after it, as FedEx's own page dates it
 * (checked 2026-10-11).
 */
function wallClockZones(entries: readonly {
  name: unknown; date: unknown; location: string; zone: string | null; placed: string | null; copy: string | undefined;
  wallClock: boolean; nationwide: boolean; fallback: string | null; known: string | null; arrival: string | null;
}[]): { zone: string | null; step: ZoneStep }[] {
  const found = entries.map((entry): { zone: string | null; step: ZoneStep } | null => !entry.wallClock
    ? entry.zone || !entry.nationwide ? { zone: entry.zone, step: 'carrier' } : null
    : entry.zone ? { zone: entry.zone, step: 'place' } : entry.copy ? { zone: entry.copy, step: 'copy' } : null);
  const walls = entries.map((entry) => mislabeledWallTime(entry.date) ?? '');
  return entries.map((entry, index) => {
    const own = found[index];
    if (own) return own;
    const key = nameKey(entry.name);
    const wall = walls[index]!;
    let before: { wall: string; zone: string } | undefined;
    let after: { wall: string; zone: string } | undefined;
    if (!entry.known || entry.arrival) {
      entries.forEach((other, at) => {
        const zone = other.wallClock !== entry.wallClock ? null : entry.wallClock ? found[at]?.zone : other.placed;
        const near = { wall: walls[at]!, zone: zone ?? '' };
        if (!zone || nameKey(other.name) !== key || !fitsPlace(zone, entry.location, true)) return;
        if (entry.arrival && (timeZoneCountry(zone) ?? NORTH_AMERICAN_ZONES.get(zone)) !== entry.arrival) return;
        if (near.wall <= wall) {
          if (!before || near.wall > before.wall) before = near;
        } else if (!after || near.wall < after.wall) after = near;
      });
    }
    const borrowed = (before ?? after)?.zone;
    const known = fitsPlace(entry.known, entry.location);
    return borrowed ? { zone: borrowed, step: 'borrowed' } : entry.fallback ? { zone: entry.fallback, step: 'routing' }
      : known ? { zone: known, step: 'known' } : { zone: null, step: 'labeled' };
  });
}

/**
 * The country the parcel is bound for, as the reply names it, or for a reply
 * that does not, as an EcoScooting reference does ("CNPRT" for Portugal,
 * "CNESP" for Spain).
 */
function replyDestination(payload: Record<string, unknown>, number: string): string | null {
  const reference = /^CN(PRT|ESP)\d{20}$/.exec(number)?.[1];
  return countryCode(payload.destinationCode) ?? countryCode(payload.destination)
    ?? (reference === 'PRT' ? 'PT' : reference === 'ESP' ? 'ES' : null);
}

/**
 * ParcelsApp relays some carriers' labels twice over, TIPSA's as
 * "ENTREGADOENTREGADO". Only a label made of two identical halves is collapsed.
 */
function relayedLabel(value: unknown): string {
  const label = typeof value === 'string' ? value.trim() : '';
  const half = label.length / 2;
  return Number.isInteger(half) && label.slice(0, half) === label.slice(half) ? label.slice(0, half) : label;
}

function parseHistory(payload: unknown, trackingNumber: string, timezone: string | null = null): CarrierResult {
  if (isRecord(payload) && payload.error === 'RELOAD') throw new ChallengeError(SOURCE);
  if (isRecord(payload) && (payload.error === 'NO_DATA' || payload.error === 'NO_TRACKER')) {
    throw new NoHistoryError(SOURCE, 'ParcelsApp has no usable shipment history');
  }
  if (!isRecord(payload) || payload.error || !Array.isArray(payload.states) || payload.states.length > MAX_EVENTS) {
    throw new SchemaError(SOURCE, 'ParcelsApp lookup unavailable');
  }
  const number = numberOf(trackingNumber);
  const events: CarrierEvent[] = [];
  const scans: { event: CarrierEvent; scan: CarrierScan }[] = [];
  const scanCarriers = new Set<unknown>();
  let undated = 0;
  // The reply is in North America when a scan certainly is, or when a scan
  // names a state or province ("Atlanta, GA") and none names another country.
  const kinds = payload.states.flatMap((raw: unknown) => {
    const location = isRecord(raw) ? scanLocation(stateCarrierName(payload, raw), raw.location) : '';
    return location ? [placeKind(location)] : [];
  });
  const inNorthAmerica = kinds.includes('certain') || (kinds.includes('region') && !kinds.includes('abroad'));
  const destination = replyDestination(payload, number);
  const instants = fourPxInstants(payload, payload.states);
  const entries: (ReturnType<typeof readState> & { raw: Record<string, unknown>; scan: CarrierScan | undefined; wording: string })[] = [];
  for (const raw of payload.states) {
    if (!isRecord(raw)) throw new SchemaError(SOURCE, 'ParcelsApp returned an invalid event');
    if (raw.require_fields || raw.error) continue;
    // A state can come without a date (an Asendia Spain leg). It has no place
    // among the dated scans, so it is counted instead of read as the latest.
    if (raw.date == null || raw.date === '') {
      undated++;
      continue;
    }
    const status = relayedLabel(raw.status);
    const state = readState(payload, raw, status, timezone, number, inNorthAmerica, destination, instants);
    const scan = carrierScan(typeof state.name === 'string' ? carrierIdFromName(state.name) : undefined, status);
    entries.push({ ...state, raw, scan, wording: scan?.wording ?? status });
  }
  // Another carrier's copy of a scan placed in its state or province (Cainiao
  // relaying UniUni's "Delivered" at the same minute, with no place) takes
  // that scan's zone, so the two stay one scan. A copy of a GOFO scan with an
  // offset of its own writes the same digits under a UTC label (YTO's, Cirro's
  // and EQuick's of GOFO France's), and takes that offset. A wall-clock scan
  // with no place copies any other carrier's placed scan this way.
  const copyKey = ({ date, wording }: typeof entries[number], wall = mislabeledWallTime(date)) => {
    const text = wall ? localEvent(date, wording)?.description : undefined;
    return wall && text ? `${wall}|${text}` : '';
  };
  const offsetClocks = entries.filter((entry) => entry.offset).map((entry) => [
    copyKey(entry, DateTime.fromISO(String(entry.date).trim(), { setZone: true }).toISO({ includeOffset: false })), `UTC${entry.offset}`] as const);
  const localClocks = new Map([
    ...entries.filter((entry) => entry.local).map((entry) => [copyKey(entry), entry.zone!] as const), ...offsetClocks,
  ].filter(([key]) => key));
  // Two placed scans with the same key on different clocks place no copy.
  const placedClocks = new Map<string, string>();
  for (const [key, zone] of [...entries.flatMap((entry) => entry.placed ? [[copyKey(entry), entry.placed] as const] : []), ...offsetClocks]) {
    if (key) placedClocks.set(key, placedClocks.has(key) && placedClocks.get(key) !== zone ? '' : zone);
  }
  const zones = wallClockZones(entries.map((entry) => ({ ...entry,
    zone: entry.wallClock ? entry.zone : (localClocks.size && !entry.local && !entry.offset ? localClocks.get(copyKey(entry)) : undefined) ?? entry.zone,
    copy: entry.wallClock && !entry.zone ? placedClocks.get(copyKey(entry)) || undefined : undefined })));
  const latest = new LatestScan(SOURCE);
  for (const [index, entry] of entries.entries()) {
    const { raw, name, scan, date } = entry;
    const { zone } = zones[index]!;
    // A DHL Express scan whose facility the rule cannot place is a wall clock
    // with no instant. Any other scan with no zone keeps ParcelsApp's label.
    const unplaced = !zone && relaysFacilityClock(name);
    const parsed = localEvent((zone ? mislabeledLocalTime(date, zone)?.iso : unplaced ? mislabeledWallTime(date) : undefined) ?? entry.labeled,
      entry.wording);
    if (parsed) latest.see(mislabeledWallTime(date) ?? '', unplaced);
    // Nor has an offset-less date that no zone resolves: a wall time, not an instant.
    if (parsed && !parsed.time) {
      undated++;
      continue;
    }
    if (parsed) {
      const location = typeof raw.location === 'string' ? raw.location.replace(/\s+/g, ' ').trim().slice(0, 200) : '';
      // Some Chronopost rows put the service label in the location field, and
      // Posti names scans outside Finland "ULKOMAILLA" (abroad).
      if (location && !/^Type de livraison\s*:/i.test(location) && !isPostiAbroadLabel(location)) parsed.location = location;
      events.push(parsed);
      scanCarriers.add(name);
    }
    if (parsed && scan) scans.push({ event: Object.assign(parsed, { stage: scan.stage, stage_source: 'carrier_map' }), scan });
  }
  markReturnLeg(scans);
  latest.check();
  if (!events.length) {
    const gates = payload.states.filter((raw: unknown): raw is Record<string, unknown> => isRecord(raw)
      && Array.isArray(raw.require_fields) && raw.require_fields.some((field: unknown) => isRecord(field) && field.name === 'zipcode'));
    if (gates.length) {
      // A gate names the carrier that asks for the postcode, as a scan does. It is
      // given only when every gate names the same one and it maps to the catalog.
      const [name, ...others] = gates.map((gate) => stateCarrierName(payload, gate));
      const carrier = typeof name === 'string' && others.every((other) => other === name)
        ? universalCarrierHints([name], number).discovered_carrier : undefined;
      throw new InputRequiredError(SOURCE, 'postcode', 'ParcelsApp requires a valid delivery postcode or further recipient information',
        carrier ? { carrier } : undefined);
    }
    // An empty history is the NO_DATA answer; states that don't parse are not an answer.
    if (!payload.states.length) throw new NoHistoryError(SOURCE, 'ParcelsApp has no usable shipment history');
    throw new IndeterminateError(SOURCE, 'No usable tracking events');
  }
  // The carriers ParcelsApp aggregated for this number ("DPD Group"), as
  // discovery hints; routing confirms one with its own adapter before adopting it.
  const services = Array.isArray(payload.services) ? payload.services : [];
  const carriers: unknown[] = Array.isArray(payload.carriers) ? payload.carriers : [];
  const hints = universalCarrierHints([
    ...carriers, ...services.map((service: unknown) => isRecord(service) ? service.name : undefined),
  ].slice(0, 20), number);
  // The list also names carriers asked without an answer. When every scan
  // names the same carrier, that carrier is the hint.
  const discovered = hints.discovered_carrier
    ?? (scanCarriers.size === 1 ? universalCarrierHints([...scanCarriers], number).discovered_carrier : undefined);
  return { ...result(events, SOURCE), ...(undated ? { undated_event_count: undated } : {}),
    ...hints, ...(discovered ? { discovered_carrier: discovered } : {}) };
}

function browserCanRecover(error: unknown): boolean {
  // A slow uncached lookup needs more time on the same API. It has already
  // had one direct retry; a new browser lookup would repeat the work again.
  if (error instanceof UpstreamNetworkError) return false;
  // A second lookup cannot repair missing input, rate limiting or an outage.
  if (error instanceof UpstreamHttpError && (error.status === 429 || error.status >= 500)) return false;
  // The browser tier reads a larger reply than the direct POST's cap.
  if (error instanceof CarrierError && error.reason === 'response_too_large') return true;
  const kind = carrierErrorKind(error);
  return kind === null || kind === 'challenge' || kind === 'transport' || kind === 'schema';
}

export function parseParcelsAppHtml(html: string, trackingNumber: string, timezone: string | null = null): CarrierResult {
  if (!parcelsIdentity(html, numberOf(trackingNumber))) throw new SchemaError(SOURCE, 'ParcelsApp shipment identity missing');
  const $ = load(html);
  const nodes = $('.tracking-info .parcel .events > .event');
  if (nodes.length > MAX_EVENTS) throw new SchemaError(SOURCE, 'ParcelsApp returned too many events');
  const events: CarrierEvent[] = [];
  // Each scan names its carrier ("DPD Group") under its wording, as the JSON
  // reply's `carriers` index does: the same zone rules then give the same
  // instants, and so the same event ids, whichever tier answered.
  const carriers: string[] = [];
  const scans: { event: CarrierEvent; scan: CarrierScan }[] = [];
  let undated = 0;
  const latest = new LatestScan(SOURCE);
  nodes.each((_, node) => {
    const row = $(node);
    if (row.find('input, select, form').length) return;
    const description = relayedLabel(row.find('.event-content > strong').first().text());
    if (isNotice(description)) return;
    const date = row.find('.event-time > strong').text().trim();
    const time = row.find('.event-time > span').text().trim();
    // Notice rows ("No information about your package...") render a date with
    // an empty time. Skip them instead of failing the whole history.
    if (!time) return;
    const name = row.find('.event-content .carrier').first().text().replace(/\s+/g, ' ').trim();
    if (name && !carriers.includes(name)) carriers.push(name);
    // The page prints a state without a date as "aN Inv NaN" at "aN:aN":
    // counted, as in the JSON reply.
    if (date.includes('NaN')) {
      undated++;
      return;
    }
    // The English web app renders the UTC digits of its API, which are the
    // scan's local clock.
    const labeled = DateTime.fromFormat(`${date} ${time}`, 'dd LLL yyyy HH:mm', { locale: 'en', zone: 'UTC' });
    if (!labeled.isValid) throw new SchemaError(SOURCE, 'ParcelsApp returned an invalid event date');
    const state = readState({ carriers }, { date: labeled.toISO(), ...(name ? { carrier: carriers.indexOf(name) } : {}) },
      description, timezone, numberOf(trackingNumber), false, replyDestination({}, numberOf(trackingNumber)));
    // The page prints no location, so no DHL Express scan has a facility to
    // read its clock in, and no other wall clock a place, a copy to take or a
    // placed scan of its network to borrow from: routing's zone, its known
    // clock or its label.
    const zone = state.zone ?? state.fallback ?? state.known;
    const scan = carrierScan(name ? carrierIdFromName(name) : undefined, description);
    const unplaced = !zone && relaysFacilityClock(name);
    latest.see(mislabeledWallTime(state.date) ?? '', unplaced);
    if (unplaced) {
      undated++;
      return;
    }
    const parsed = event((zone ? mislabeledLocalTime(state.date, zone)?.iso : undefined) ?? state.labeled, scan?.wording ?? description);
    if (parsed) events.push(parsed);
    if (parsed && scan) scans.push({ event: Object.assign(parsed, { stage: scan.stage, stage_source: 'carrier_map' }), scan });
  });
  markReturnLeg(scans);
  latest.check();
  return { ...result(events, SOURCE), ...(undated ? { undated_event_count: undated } : {}),
    ...universalCarrierHints(carriers.slice(0, 20), numberOf(trackingNumber)) };
}

export interface ParcelsAppOptions {
  trawl?: TrawlClient | null;
  fetcher?: typeof fetch;
  recorder?: StepRecorder;
  timeoutMs?: number;
  userAgent?: string;
  /** Null runs only the existing browser capture tier. */
  httpClient?: ParcelsAppHttpClient | null;
}

export class ParcelsAppTracker {
  private readonly http: ParcelsAppHttpClient | null;

  constructor(readonly options: ParcelsAppOptions = {}) {
    this.http = options.httpClient === undefined ? new ParcelsAppHttpClient(options.fetcher, options.userAgent) : options.httpClient;
  }

  async fetch(trackingNumber: string, budgetMs = this.options.timeoutMs ?? PARCELSAPP_BUDGET_MS, postcode?: string | null, timezone: string | null = null, signal?: AbortSignal): Promise<CarrierResult> {
    const number = numberOf(trackingNumber);
    if (!Number.isFinite(budgetMs) || budgetMs < 1) throw new TypeError('ParcelsApp timeout must be positive');
    const deadline = performance.now() + budgetMs;
    const request = async (remainingMs: number, signal: AbortSignal): Promise<CarrierResult> => {
      const payload = await this.http!.fetch(number, Math.max(1, Math.min(DIRECT_BUDGET_MS, Math.floor(remainingMs))), postcode, signal);
      // This endpoint returns one shipment per POST, synchronously, with no
      // shared session or polling handle. Each retry keeps its own request
      // binding. Numberless browser captures never get this exemption.
      if (isRecord(payload) && payload.correctId && payload.correctId !== number) {
        throw new SchemaError(SOURCE, 'ParcelsApp returned an unverified tracking alias');
      }
      return { ...parseHistory(payload, number, timezone), tracking_source: 'structured-web-response' };
    };
    return runSteps({ carrier: SOURCE, budgetMs, signal, recorder: this.options.recorder }, [{
      id: 'direct',
      enabled: this.http !== null,
      run: ({ remainingMs, signal }) => request(remainingMs, signal),
    }, {
      id: 'retry',
      enabled: this.http !== null,
      // Uncached carrier aggregation can outlive a timed-out HTTP request.
      // Retry a replayable network failure with the same input, within the
      // original lookup budget.
      recovers: (error) => error instanceof UpstreamNetworkError && deadline - performance.now() > RETRY_DELAY_MS + 1,
      run: async ({ signal }) => {
        await timers.setTimeout(RETRY_DELAY_MS, undefined, { signal });
        signal.throwIfAborted();
        return request(deadline - performance.now(), signal);
      },
    }, {
      id: 'trawl',
      enabled: this.options.trawl != null || this.http === null,
      recovers: browserCanRecover,
      run: async ({ remainingMs, signal }) => {
        const capture: CaptureSpec = {
          source: SOURCE, url: `https://parcelsapp.com/en/tracking/${number}`, apiUrl: PARCELSAPP_API,
          budgetMs: remainingMs, fetcher: this.options.fetcher, signal,
        };
        const page = await loadCapture(this.options.trawl ?? null, capture);
        for (const body of capturedBodies(page, capture)) {
          try {
            return parseParcelsAppResponse(JSON.parse(body), number, page.html, timezone);
          } catch {
            // Polling replies, unrelated numbers and demo shipments are not history.
          }
        }
        // The rendered page carries the same history when no body was readable.
        return parseParcelsAppHtml(page.html, number, timezone);
      },
    }]);
  }
}

export const adapter: AdapterFactory = (environment) => {
  const tracker = new ParcelsAppTracker({
    trawl: environment.trawl, fetcher: environment.fetcher, recorder: environment.recorder, userAgent: environment.userAgent,
  });
  return {
    id: SOURCE,
    steps: ['direct', 'retry', 'trawl'],
    track: (input, context) => tracker.fetch(input.number, context?.budgetMs, input.postcode, input.timezone ?? null, context?.signal),
  };
};
