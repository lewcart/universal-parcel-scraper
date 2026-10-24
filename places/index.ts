
import { readFileSync } from 'node:fs';
import { brotliDecompressSync } from 'node:zlib';
import { CARRIER_DEFINITIONS } from '../core/catalog/definitions.js';
import { timeZoneCountry } from '../core/time/index.js';
import { ambiguousAddressCodes, militaryPostOffice, trackingPlace } from './trackingLocation.js';
import facilityList from './facilities.json' with { type: 'json' };
import hubList from './hubs.json' with { type: 'json' };
import { nameKey, nameKeys } from './names.mjs';
import { mainZone, pointZone, regionZone } from './zones.js';

export { carrierHomeZone, dateLocalClocks, type ZoneBasis } from './clocks.js';

/** Where a scan happened, as precisely as its free-text location allows. */
export interface EventPlace {
  latitude: number;
  longitude: number;
  precision: 'city' | 'country';
  /** ISO 3166-1 alpha-2. */
  country: string;
  name: string;
  /** The facility name, when distinct from the town. */
  site?: string;
}

/** Where a carrier itself puts a scan's facility (`point` on a stored scan). */
export interface EventPoint {
  latitude: number;
  longitude: number;
}

export interface PlaceHints {
  /** Countries the parcel is likely in, strongest first: neighbouring scans, destination, carrier. */
  countries?: readonly string[];
  /** The parcel's carriers, by catalog id: a hub of their own is known by the name they give it. */
  carriers?: readonly string[];
}

interface Airport { code: string; country: string; latitude: number; longitude: number; name: string; town: string }
interface Region { country: string; admin1: string }

interface Gazetteer {
  names: string[];
  /** Country, admin1 and admin2 as indices into `codes`: most of 230,000 places share a few thousand codes. */
  codes: string[];
  country: Uint16Array;
  admin1: Uint16Array;
  admin2: Uint16Array;
  latitude: Float32Array;
  longitude: Float32Array;
  /** In thousands. Postal localities without a census count are 0. */
  population: Uint32Array;
  /** Place indices; alternate names (exonyms, translations) are stored as ~index. */
  keys: Map<string, number | number[]>;
  postcodes: Map<string, { latitude: number; longitude: number }>;
  countries: Map<string, { name: string; latitude: number; longitude: number }>;
  /** First-level regions by name: "ontario" is CA 08. */
  regions: Map<string, Region[]>;
  /** The names of each region, by country and code: "BG.42" is "sofia capital". */
  regionNames: Map<string, string[]>;
  /** Airports with scheduled flights, by IATA code. */
  airports: Map<string, Airport>;
  /** The places of each country, filled when first asked for. */
  byCountry: Map<string, number[]>;
}

const DATA = new URL('./places.tsv.br', import.meta.url);
const PINCODES = new URL('./pincodes.json', import.meta.url);
// Words for facilities and services rather than places ("Agence DPD de La Crau", "PAKETZENTRUM", "ISC NEW YORK NY(USPS)").
const FACILITY_WORDS = new Set(`
  agence agency air airport area branch bureau cedex cidex center centre centro centrum clasificacion colis
  customs delivery depot deposito destination distribution distribuicao dogana douane export facility filiale
  gateway hub import international intl livraison local location logistics logistik mail oddzial office oficina
  operations operativo origin paketzentrum briefzentrum verteilzentrum sortierzentrum zustellbasis zustellstelle
  parcel parcels plateforme platform point postal postfiliale postfach poste pz bz return service services site
  smistamento sort sorting station terminal tratamento tri unidade ufficio warehouse zentrum zoll zollamt
  dhl ups fedex gls dpd tnt usps colissimo chronopost postnl bpost evri hermes cainiao yanwen parcelforce posti
  planzer quickpac amazon express post home house address recipient sender neighbourhood neighborhood unknown
  courrier courier exchange foreign network processing transit worldwide isc ndc idc piac pic pfc ppdc cdis ctc
  gpo nsh rms tmo fpo aeroport aeroporto aeropuerto flughafen luchthaven lufthavn flygplats lentoasema lotnisko
`.trim().split(/\s+/));
// Administrative words a town can be written with or without ("Jinhua City", "Guangdong Sheng").
const DIVISION_WORDS = new Set('city province prefecture district county shi sheng qu xian si gu do ku ken'.split(' '));
// Words that say a scan happened at an airport ("Frankfurt Airport (FRA)", "HELSINKI-VANTAAN LENTOASEMA").
const AIRPORT_WORDS = new Set('airport aeroport aeroporto aeropuerto flughafen luchthaven lufthavn flygplats lentoasema lotnisko'.split(' '));
// Words of airport names that do not tell one airport from another.
const AIRPORT_NAME_WORDS = new Set(`
  airport international intl regional municipal national field airfield aerodrome air base the de del la le du of and
  city county metropolitan
`.trim().split(/\s+/));
// Region names too vague to place a scan in their country on their own.
const VAGUE_REGIONS = new Set('central capital north south east west centre center islands national federal'.split(' '));
const LEADING_WORDS = new Set(['de', 'du', 'des', 'di', 'da', 'del', 'della', 'von', 'of']);
// Carriers print provinces the way the post does; GeoNames numbers them.
const ADMIN_CODES: Record<string, Record<string, string>> = {
  CA: { AB: '01', BC: '02', MB: '03', NB: '04', NL: '05', NS: '07', ON: '08', PE: '09', QC: '10', SK: '11', YT: '12', NT: '13', NU: '14' },
  AU: { ACT: '01', NSW: '02', NT: '03', QLD: '04', SA: '05', TAS: '06', VIC: '07', WA: '08' },
  BR: {
    AC: '01', AL: '02', AP: '03', AM: '04', BA: '05', CE: '06', DF: '07', ES: '08', MS: '11', MA: '13', MT: '14', MG: '15',
    PA: '16', PB: '17', PR: '18', PI: '20', RJ: '21', RN: '22', RS: '23', RO: '24', RR: '25', SC: '26', SP: '27', SE: '28',
    GO: '29', PE: '30', TO: '31',
  },
};
// A place nothing else confirms has to be a known town, not a hamlet with the same name.
const UNCONFIRMED_MIN_THOUSANDS = 15;
// A carrier's own point for a scan has to agree with the town its text names.
const POINT_MAX_KM = 30;
// An airport a scan names has to be this close to the town it names.
const AIRPORT_MAX_KM = 60;
// A hub's name ranks like a town of this many thousand people.
const HUB_THOUSANDS = 50;
// A carrier that delivers in more countries than this is at home in none of them.
const HOME_COUNTRIES_MAX = 6;
// A town only its name places is a namesake when it takes the parcel this far off its way,
const DETOUR_MAX_KM = 6000;
// or, where the scans stop, when it is this far from them and from the parcel's countries.
const LEAP_MAX_KM = 3000;
// There, a city of this many thousand people is known wherever it is written.
const WORLD_CITY_THOUSANDS = 1000;
/** The city a region is named after ("Santo Domingo Province") has at least this many thousand people. */
const NAMESAKE_THOUSANDS = 100;
// A town of that size this many times larger than its namesake in a country the parcel is in keeps its name.
const DOMINANT_TIMES = 10;
// Scans that record paperwork, which an office can file where the parcel is not.
const PAPERWORK_STAGES = new Set(['registered', 'pending', 'customs']);
// Such a scan in a town this far off the way between the parcel's handling scans was filed elsewhere.
const AWAY_DETOUR_KM = 300;
// No parcel travels faster than a plane, and two hours absorb a scan clock's rounding and delays.
const PLANE_KMH = 1000;
const CLOCK_SLACK_HOURS = 2;

// Swiss Post scans end in the site's six-digit number: "Zürich Briefzentrum 801050".
const FACILITIES = new Map(facilityList.map((facility) => [`${facility.country}:${facility.code}`, facility]));
interface Hub {
  country: string;
  names: string[];
  town: string;
  /** The state, province or canton, where carriers write one after the town. */
  admin1?: string;
  /** The facility's own name, when the carrier's words are not the town's. */
  site?: string;
  airport?: string;
  latitude?: number;
  longitude?: number;
  /** The carriers whose hub this is; any carrier's when absent. */
  carriers?: string[];
}
// Names carriers give a hub instead of its town ("ROISSY" is Paris-Charles de Gaulle, not
// Roissy-en-Brie), and hubs the gazetteer cannot place by name ("SEKOCIN STARY", "Fenggang Town", "TERRASSON").
const HUBS = new Map<string, Hub[]>();
for (const hub of hubList as Hub[]) for (const name of hub.names) HUBS.set(nameKey(name), [...HUBS.get(nameKey(name)) ?? [], hub]);

let loaded: Gazetteer | null = null;

/** Indian PIN codes by town: runs of PINs `[first, last, town]`, in order, and the towns. */
interface Pincodes { towns: [string, number, number][]; ranges: [number, number, number][] }
let pincodes: Pincodes | null = null;

function gazetteer(): Gazetteer {
  if (loaded) return loaded;
  // Parsed straight from bytes: substrings of one decompressed string would keep all 10 MB of it alive.
  const bytes = brotliDecompressSync(readFileSync(DATA));
  const rows: string[][] = [];
  for (let start = 0; start < bytes.length;) {
    let end = bytes.indexOf(10, start);
    if (end < 0) end = bytes.length;
    const fields: string[] = [];
    for (let field = start; field <= end;) {
      let stop = bytes.indexOf(9, field);
      if (stop < 0 || stop > end) stop = end;
      fields.push(bytes.toString('utf8', field, stop));
      field = stop + 1;
    }
    rows.push(fields);
    start = end + 1;
  }
  const count = rows.filter((fields) => fields[0] === 'P').length;
  const data: Gazetteer = {
    names: [], codes: [],
    country: new Uint16Array(count), admin1: new Uint16Array(count), admin2: new Uint16Array(count),
    latitude: new Float32Array(count), longitude: new Float32Array(count), population: new Uint32Array(count),
    keys: new Map(), postcodes: new Map(), countries: new Map(), regions: new Map(), regionNames: new Map(), airports: new Map(), byCountry: new Map(),
  };
  const codeIndex = new Map<string, number>();
  const code = (value: string) => {
    let index = codeIndex.get(value);
    if (index === undefined) {
      index = data.codes.push(value) - 1;
      codeIndex.set(value, index);
    }
    return index;
  };
  const add = (key: string, entry: number) => {
    const existing = data.keys.get(key);
    if (existing === undefined) data.keys.set(key, entry);
    else if (typeof existing === 'number') {
      if (existing !== entry) data.keys.set(key, [existing, entry]);
    } else if (!existing.includes(entry)) existing.push(entry);
  };
  let index = 0;
  for (const fields of rows) {
    if (fields[0] === 'P') {
      const [, name, ascii, country, admin1, admin2, latitude, longitude, population, alternates] = fields;
      data.names.push(name!);
      data.country[index] = code(country!);
      data.admin1[index] = code(admin1!);
      data.admin2[index] = code(admin2!);
      data.latitude[index] = Number(latitude);
      data.longitude[index] = Number(longitude);
      data.population[index] = Number(population);
      for (const key of [...nameKeys(name!), ...(ascii ? nameKeys(ascii) : [])]) add(key, index);
      for (const key of alternates ? alternates.split(',') : []) add(key, ~index);
      index += 1;
    } else if (fields[0] === 'Z') {
      const [, country, postcode, latitude, longitude] = fields;
      data.postcodes.set(`${country}:${postcode}`, { latitude: Number(latitude), longitude: Number(longitude) });
    } else if (fields[0] === 'C') {
      const [, country, name, longitude, latitude] = fields as [string, string, string, ...string[]];
      data.countries.set(country, { name, latitude: Number(latitude), longitude: Number(longitude) });
    } else if (fields[0] === 'R') {
      const [, country, admin1, keys] = fields as [string, string, string, string];
      data.regionNames.set(`${country}.${admin1}`, keys.split(','));
      for (const key of keys.split(',')) data.regions.set(key, [...data.regions.get(key) ?? [], { country, admin1 }]);
    } else if (fields[0] === 'A') {
      const [, code, country, latitude, longitude, name, town] = fields as [string, string, string, string, string, string, string];
      data.airports.set(code, { code, country, latitude: Number(latitude), longitude: Number(longitude), name, town });
    }
  }
  loaded = data;
  return data;
}

/** Loads the gazetteer ahead of the first request that needs it. */
export function preloadPlaces(): void {
  gazetteer();
}

function distanceKm(latitude1: number, longitude1: number, latitude2: number, longitude2: number): number {
  const radians = Math.PI / 180;
  const a = Math.sin((latitude2 - latitude1) * radians / 2) ** 2
    + Math.cos(latitude1 * radians) * Math.cos(latitude2 * radians) * Math.sin((longitude2 - longitude1) * radians / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(a));
}

/** The gazetteer's places in a country. */
function countryPlaces(country: string): readonly number[] {
  const data = gazetteer();
  if (!data.byCountry.size) {
    data.country.forEach((code, index) => {
      const name = data.codes[code]!;
      const list = data.byCountry.get(name);
      if (list) list.push(index);
      else data.byCountry.set(name, [index]);
    });
  }
  return data.byCountry.get(country) ?? [];
}

/** How far a point is from a country: from the nearest of its towns. */
function countryDistanceKm(country: string, latitude: number, longitude: number): number {
  const data = gazetteer();
  let nearest = Infinity;
  for (const index of countryPlaces(country)) {
    nearest = Math.min(nearest, distanceKm(latitude, longitude, data.latitude[index]!, data.longitude[index]!));
  }
  return nearest;
}

/** The state or province of the town nearest a point in a country, by postal code ("IL", "ON", "NSW"). */
function regionNear(country: string, latitude: number, longitude: number): string | null {
  const data = gazetteer();
  let nearest = -1;
  let best = Infinity;
  for (const index of countryPlaces(country)) {
    const distance = distanceKm(latitude, longitude, data.latitude[index]!, data.longitude[index]!);
    if (distance < best) [nearest, best] = [index, distance];
  }
  if (nearest < 0) return null;
  const admin1 = data.codes[data.admin1[nearest]!] ?? '';
  const postal = Object.entries(ADMIN_CODES[country] ?? {}).find(([, code]) => code === admin1)?.[0];
  return postal ?? admin1;
}

/**
 * The zone of an airport its IATA code alone names ("AMS"), as forwarders write
 * their air legs. Such a code places nothing on a map, but it can still tell a
 * scan's clock.
 */
export function airportTimeZone(code: string): string | null {
  const airport = /^[A-Z]{3}$/.test(code.trim()) ? gazetteer().airports.get(code.trim()) : undefined;
  return airport ? placeTimeZone({ ...airport, precision: 'city', name: airport.town }) : null;
}

const ZONED_REGIONS = new Set(['US', 'CA', 'AU', 'BR']);
const zoneCache = new Map<string, string | null>();

/**
 * The zone a scan at this place keeps its clock on: its country's, or where a
 * country keeps several, its state's or province's (the US, Canada, Australia,
 * Brazil) or the zone whose principal place lies nearest. A place that names
 * only a country with several zones takes the one most of its people live on.
 * Null for a country the tz database does not know.
 */
export function placeTimeZone(place: EventPlace): string | null {
  if (place.precision === 'country') return mainZone(place.country);
  const key = `${place.country}|${place.latitude.toFixed(2)}|${place.longitude.toFixed(2)}`;
  if (zoneCache.has(key)) return zoneCache.get(key)!;
  const region = ZONED_REGIONS.has(place.country) ? regionNear(place.country, place.latitude, place.longitude) : null;
  const zone = (region ? regionZone(place.country, region) : null) ?? pointZone(place.country, place.latitude, place.longitude);
  if (zoneCache.size >= CACHE_SIZE) zoneCache.clear();
  zoneCache.set(key, zone);
  return zone;
}

/** The instant an ISO 8601 time stands for, when it gives its offset. */
function instant(time: string | null | undefined): number | null {
  if (!time || !/(?:Z|[+-]\d\d:?\d\d)$/i.test(time.trim())) return null;
  const value = Date.parse(time);
  return Number.isFinite(value) ? value : null;
}

/**
 * The scans the parcel was not at. A scan that records paperwork, or names only
 * a country, can be filed ahead of the parcel: customs clears it at the
 * destination's office while it is still abroad, and a destination carrier
 * registers it before it has left. The scans that handle it in a town say
 * where it is, and such a scan is away when:
 * - it lies more than 300 km off the way between the handling scans before
 *   and after it, measured from a country's nearest town;
 * - the parcel would have flown faster than a plane between it and the
 *   handling scan before or after it;
 * - the handling scans around it are in other countries, and the parcel
 *   only comes to its country later.
 */
function awayScans(
  places: readonly (EventPlace | null)[],
  stages: readonly (string | null | undefined)[],
  times: readonly (string | null | undefined)[],
): Set<number> {
  const away = new Set<number>();
  const paperwork = (index: number) => PAPERWORK_STAGES.has(stages[index] ?? '');
  const handled = places.flatMap((place, index) => place?.precision === 'city' && !paperwork(index) ? [index] : []);
  const reach = (from: EventPlace, to: EventPlace) => from.precision === 'country'
    ? countryDistanceKm(from.country, to.latitude, to.longitude)
    : distanceKm(from.latitude, from.longitude, to.latitude, to.longitude);
  places.forEach((place, index) => {
    if (!place || (place.precision === 'city' && !paperwork(index))) return;
    const before = handled.filter((at) => at < index).at(-1);
    const after = handled.find((at) => at > index);
    const offWay = () => {
      if (before === undefined || after === undefined) return false;
      const [from, to] = [places[before]!, places[after]!];
      return reach(place, from) + reach(place, to) - distanceKm(from.latitude, from.longitude, to.latitude, to.longitude) > AWAY_DETOUR_KM;
    };
    const at = instant(times[index]);
    const flown = (other: number | undefined) => {
      const then = other === undefined || at === null ? null : instant(times[other]);
      return then !== null && reach(place, places[other!]!) > PLANE_KMH * (Math.abs(at! - then) / 3_600_000 + CLOCK_SLACK_HOURS);
    };
    const elsewhere = (other: number | undefined) => other === undefined || places[other]!.country !== place.country;
    const ahead = () => after !== undefined && elsewhere(before) && elsewhere(after)
      && places.some((later, at) => at > after && later?.country === place.country && !paperwork(at));
    if (offWay() || flown(before) || flown(after) || ahead()) away.add(index);
  });
  return away;
}

interface Token { key: string; start: number; end: number }
/** Where in its field a phrase was read, and whether it is all the field says. */
interface Phrase { key: string; text: string; rank: number; start: number; end: number; whole: boolean }

const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

function tokens(text: string): Token[] {
  return [...text.matchAll(/[\p{L}\p{N}]+/gu)].flatMap((match) => {
    if (CJK.test(match[0])) return [];
    // "BARCELONA2": a depot number glued to the town.
    const word = /\p{L}/u.test(match[0]) ? match[0].replace(/\d+$/u, '') : match[0];
    const key = nameKey(word);
    return key ? [{ key, start: match.index, end: match.index + word.length }] : [];
  });
}

/** Phrases worth looking up, most specific first: "zurich mulligen", then "zurich". */
function phrases(field: string): Phrase[] {
  const all = tokens(field).filter((token) => !/^\d+$/.test(token.key));
  const found: Phrase[] = [];
  const add = (list: Token[], rank: number, whole = false) => {
    if (!list.length) return;
    const key = list.map((token) => token.key).join(' ');
    const seen = found.find((phrase) => phrase.key === key);
    // "Guangdong" is all "Guangdong Province" says, once its administrative word is gone.
    if (seen) seen.whole ||= whole;
    else if (key.length >= 3) {
      const [start, end] = [list[0]!.start, list.at(-1)!.end];
      found.push({ key, text: field.slice(start, end), rank, start, end, whole });
    }
  };
  // Facility words alone ("Hub", "Terminal") are no town, whatever GeoNames says.
  if (all.some((token) => !FACILITY_WORDS.has(token.key))) add(all, 0, true);
  let words = all.filter((token) => !FACILITY_WORDS.has(token.key));
  while (words.length && LEADING_WORDS.has(words[0]!.key)) words = words.slice(1);
  const spans = (list: Token[], offset: number) => {
    for (let count = list.length; count > 0; count -= 1) add(list.slice(0, count), offset + list.length - count + 1, count === list.length);
    for (let start = 1; start < list.length; start += 1) add(list.slice(start), offset + list.length + start);
  };
  spans(words, 0);
  // "Zhejiang Province Jinhua City": the town without its administrative words.
  const bare = words.filter((token) => !DIVISION_WORDS.has(token.key));
  if (bare.length < words.length) spans(bare, 1);
  return [...found, ...cjkPhrases(field)];
}

/**
 * Chinese and Japanese addresses run their divisions together, each closed by its
 * suffix: "广东省深圳市宝安区" is Guangdong province, Shenzhen city, Bao'an district.
 * A facility follows its town without one: "深圳转运中心".
 */
function cjkPhrases(field: string): Phrase[] {
  const found: Phrase[] = [];
  for (const run of field.matchAll(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]+/gu)) {
    let start = run.index;
    run[0].split(/(?<=[省市区县都府県])/u).forEach((segment, index) => {
      const end = start + segment.length;
      const add = (key: string, rank: number) => {
        if (key.length >= 2 && !found.some((phrase) => phrase.key === key)) found.push({ key, text: segment, rank, start, end, whole: false });
      };
      const bare = segment.replace(/[省市区县都府県]$/u, '');
      add(segment, index * 2);
      add(bare, index * 2);
      for (let length = Math.min(bare.length - 1, 4); length >= 2; length -= 1) add(bare.slice(0, length), index * 2 + 3);
      start = end;
    });
  }
  return found;
}

interface Candidate {
  country: string;
  admin1: string;
  admin2: string;
  latitude: number;
  longitude: number;
  /** In thousands. */
  thousands: number;
  alternate: boolean;
  name: string;
  site?: string;
  hub?: boolean;
  /** A hub of one of the parcel's carriers. */
  own?: boolean;
  /** The name is the town's whatever the carrier wrote: its words are the facility's. */
  named?: boolean;
}

/**
 * The places a phrase can name. A hub's name replaces the towns of its country that share
 * it; a hub of the parcel's carrier stands beside them, ahead ("Buchs" is DPD's depot in
 * Buchs ZH on a DPD parcel, and still the town of St. Gallen or Aargau that says so).
 */
function candidates(data: Gazetteer, key: string, carriers: readonly string[]): Candidate[] {
  const hub = HUBS.get(key)?.find((entry) => !entry.carriers || entry.carriers.some((carrier) => carriers.includes(carrier)));
  // At its airport, or at its own point when its village is too small for the gazetteer.
  const airport = hub?.airport ? data.airports.get(hub.airport) : undefined;
  const point = airport ?? (hub?.latitude !== undefined && hub.longitude !== undefined ? { latitude: hub.latitude, longitude: hub.longitude } : undefined);
  const towns = [data.keys.get(key) ?? []].flat().flatMap((entry): Candidate[] => {
    const index = entry < 0 ? ~entry : entry;
    const country = data.codes[data.country[index]!]!;
    if (point && country === hub!.country && !hub!.carriers) return [];
    return [{
      country, admin1: data.codes[data.admin1[index]!] ?? '', admin2: data.codes[data.admin2[index]!] ?? '',
      latitude: data.latitude[index]!, longitude: data.longitude[index]!, thousands: data.population[index]!,
      alternate: entry < 0, name: data.names[index]!,
    }];
  });
  if (!hub || !point) return towns;
  return [...towns, {
    country: hub.country, admin1: hub.admin1 ?? '', admin2: '', latitude: point.latitude, longitude: point.longitude,
    thousands: HUB_THOUSANDS, alternate: false, name: hub.town, hub: true,
    ...(airport ? { site: airport.name } : hub.site ? { site: hub.site, named: true } : {}),
    ...(hub.carriers ? { own: true } : {}),
  }];
}

/**
 * A place, and whether the scan's own text says where it is rather than the town's name
 * alone. For a town: how many thousand people it has, and whether other towns share its name.
 */
interface Located { place: EventPlace; text: boolean; thousands?: number; shared?: boolean }

/**
 * Turns one carrier location ("ZUERICH, CH", "Härkingen 4622", "Agence DPD de
 * La Crau (283)", "Germany") into a place, or null when the text names no
 * place we can be confident about. A wrong dot is worse than no dot.
 */
export function locatePlace(location: string | null | undefined, hints: PlaceHints = {}): EventPlace | null {
  return locate(location, hints)?.place ?? null;
}

/** `split` reads a country the text names apart from its town; without it the whole text is the town's. */
function locate(location: string | null | undefined, hints: PlaceHints, split = true): Located | null {
  const text = location?.trim();
  // A military post office's base can be anywhere in its region (`militaryPostOffice`).
  if (!text || militaryPostOffice(text)) return null;
  const facility = facilityPlace(text);
  if (facility) return { place: facility, text: true };
  const data = gazetteer();
  const explicit = split ? trackingPlace(text) : { country: null, place: text };
  let country = explicit.country && data.countries.has(explicit.country) ? explicit.country : null;
  let rest = explicit.country ? explicit.place : text;
  const context = hints.countries ?? [];
  const carriers = hints.carriers ?? [];
  const station = stationPlace(data, text, context, carriers);
  if (station) return station;
  const hinted = [...context];
  const admin: string[] = [];
  const postcodes: string[] = [];
  // How the country is written after the place, when it is: "(TO)", ", CH", " - CANADA".
  const written = country && rest && text.startsWith(rest) ? text.slice(rest.length) : '';
  // As its two-letter code, which a province can share: "PINEROLO (TO)" is in Turin's, not Tonga.
  const coded = country !== null && /[A-Z]/.test(written) && written.split(/[^A-Za-z]+/).filter(Boolean).every((word) => word === country);
  const bracketed = coded && written.includes('(');
  if (coded) admin.push(country!);
  // A code that ends the text without a comma is the country, unless the town
  // before it is in a state or province of that code: "CURITIBA - PR" is Paraná.
  let looseCountry = false;

  // A trailing code without a comma ("ZUERICH CH"), or one that is also a state
  // or canton ("KOELN, DE", "Buchs SG"): a hint either way.
  const trailing = /[\s,;]+([A-Z]{2})$/.exec(rest)?.[1];
  if (!country && trailing && data.countries.has(trailing)) {
    rest = rest.slice(0, -trailing.length).replace(/[\s,;-]+$/, '');
    hinted.unshift(trailing);
    admin.push(trailing);
    if (!/,|;/.test(text.slice(0, -trailing.length)) && !ambiguousAddressCodes.has(trailing)) {
      country = trailing;
      looseCountry = true;
    }
  }
  for (const match of rest.matchAll(/\b([A-Z]{2,3})\b/g)) admin.push(match[1]!);
  for (const match of rest.matchAll(/(?:\b[A-Z]{1,2}-)?\b(\d{4,5})\b/g)) postcodes.push(match[1]!);
  // French departments and Italian provinces in brackets: "Sausheim 68 (68)", "Cologne (BS)".
  for (const match of rest.matchAll(/\((\d{2}|[A-Z]{2})\)|(?:^|\s)(\d{2})(?=\s|$)/g)) admin.push(match[1] ?? match[2]!);
  // A state, province or canton written where one belongs, as a field of its own or at the
  // end of one ("Earth City, MO", "Buchs AG", "LAUREL, MD 20707"): the town is in it.
  const stated = text.split(/[,;|()]/).flatMap((field) => /(?:^|\s)([A-Z]{2})(?:\s+\d{4,5}(?:-\d{4})?)?$/.exec(field.trim())?.[1] ?? []);

  // Postcodes only confirm a name, and only in a country the scan or the parcel
  // names: on its own, "2024" is more likely a year than a village.
  const countries = country ? [country] : hinted;
  let postcode: { latitude: number; longitude: number; country: string } | null = null;
  for (const code of postcodes) {
    for (const candidateCountry of countries) {
      const entry = data.postcodes.get(`${candidateCountry}:${code}`);
      if (entry) {
        postcode = { ...entry, country: candidateCountry };
        break;
      }
    }
    if (postcode) break;
  }

  const fields = rest.split(/[,;|()]|\s+-\s+/).map((field) => field.trim()).filter(Boolean);
  const fieldPhrases = fields.map((field, index) => {
    const list = phrases(field);
    // "Frankfurt (Oder)": a town whose name has brackets of its own.
    const whole = index === 0 && rest.includes('(') ? nameKey(rest) : '';
    return whole && data.keys.has(whole) ? [{ key: whole, text: rest, rank: 0, start: 0, end: rest.length, whole: true }, ...list] : list;
  });
  // Regions named elsewhere in the text ("STERLING - Virginia - USA", "广东省深圳市") tell towns of one name apart.
  const regions = fieldPhrases.flatMap((list, field) => list.flatMap((phrase) =>
    (data.regions.get(phrase.key) ?? []).map((region) => ({ ...region, field, start: phrase.start, end: phrase.end }))));
  // The longest region name wins where two overlap: "Morona-Santiago Province" is not Santiago Province.
  const outer = regions.filter((region) => !regions.some((other) => other.field === region.field
    && other.start < region.end && other.end > region.start && other.end - other.start > region.end - region.start));

  let best: { place: Candidate; score: number; text: string; field: number; backed: boolean; shared: boolean } | null = null;
  // Whether the text names a town at all, even one nothing confirms.
  let namesTown = false;
  for (const [fieldIndex, list] of fieldPhrases.entries()) {
    for (const phrase of list) {
      const own = data.regions.get(phrase.key) ?? [];
      // Words of a region's name are towns of that region at most: the "Delgado"
      // of "Cabo Delgado Province" is in Mozambique or nowhere.
      const around = outer.filter((region) => region.field === fieldIndex && region.start <= phrase.start
        && region.end >= phrase.end && region.end - region.start > phrase.end - phrase.start);
      const local = around.filter((region) => region.country === country || hinted.includes(region.country));
      const within = local.length ? local : around;
      // A field that only names a region is that region when it follows the town
      // ("STERLING - Virginia - USA"), or when the region is in the parcel's countries
      // ("Santa Catarina" on a Brazilian parcel).
      const named = phrase.whole ? own.filter((region) => (!country || region.country === country)
        && (fieldIndex > 0 || region.country === country || hinted.includes(region.country))) : [];
      // A hub's name inside a longer place name is part of that name: "Beauregard-de-Terrasson"
      // is a village, not the agency at Terrasson, and "Roissy-en-Brie" is no airport.
      const partOfName = list.some((other) => other.start <= phrase.start && other.end >= phrase.end
        && other.key.length > phrase.key.length && data.keys.has(other.key));
      const towns = candidates(data, phrase.key, carriers).filter((place) => !place.hub || !partOfName);
      namesTown ||= towns.length > 0;
      for (const place of towns) {
        // A town may still be named like the region it lies in: Moscow in "…, Moscow",
        // Sofia in its own "Sofia-Capital" rather than the province of Sofia around it.
        const namesRegion = ` ${(data.regionNames.get(`${place.country}.${place.admin1}`) ?? []).join(' , ')} `.includes(` ${phrase.key} `);
        const inside = (scope: readonly Region[]) => scope.some((region) =>
          region.country === place.country && (region.admin1 === place.admin1 || namesRegion));
        // …or be the city a region is named after, wherever the line between them runs
        // ("Santo Domingo Province"); a village that shares the name is no such city.
        const namesake = (scope: readonly Region[]) => place.thousands >= NAMESAKE_THOUSANDS
          && own.some((region) => region.country === place.country
            && scope.some((other) => other.country === region.country && other.admin1 === region.admin1));
        if (within.length && !inside(within) && !namesake(within)) continue;
        if (named.length && !inside(named) && !(fieldIndex === 0 && namesake(named))) continue;
        const adminCodes = [place.admin1, place.admin2].filter(Boolean);
        const adminMatch = admin.some((code) => adminCodes.includes(code) || ADMIN_CODES[place.country]?.[code] === place.admin1)
          || regions.some((region) => region.country === place.country && region.admin1 === place.admin1
            && (region.field !== fieldIndex || region.end <= phrase.start || region.start >= phrase.end));
        // "Earth City, MO" is not Earth in Texas: a state its country has, and the town is not in.
        if (!adminMatch && stated.some((code) => data.regionNames.has(`${place.country}.${ADMIN_CODES[place.country]?.[code] ?? code}`))) continue;
        const inCountry = place.country === country;
        if (country && !inCountry && !((looseCountry || coded) && adminMatch)) continue;
        const hint = hinted.indexOf(place.country);
        const postcodeMatch = postcode !== null && postcode.country === place.country
          && distanceKm(postcode.latitude, postcode.longitude, place.latitude, place.longitude) < 30;
        const confirmed = inCountry || hint >= 0 || adminMatch || postcodeMatch;
        if (!confirmed && place.thousands < UNCONFIRMED_MIN_THOUSANDS) continue;
        const score = Math.log10(Math.max(place.thousands, .3) * 1000)
          + (place.alternate ? 0 : 1.8)
          + (inCountry ? 4 : hint >= 0 ? 2.5 - Math.min(hint, 3) * .4 : 0)
          + (adminMatch ? 3 : 0) + (postcodeMatch ? 3 : 0) + (place.own ? 3 : 0)
          - phrase.rank * .3 - fieldIndex * .5;
        if (!best || score > best.score) {
          best = { place, score, text: phrase.text, field: fieldIndex, backed: inCountry || adminMatch || postcodeMatch, shared: towns.length > 1 };
        }
      }
    }
  }

  if (best) {
    const { place, text: carrierWords } = best;
    const airport = place.hub ? null : airportFor(data, rest, fields[best.field] ?? rest, place, carrierWords, country);
    return {
      text: best.backed,
      thousands: place.thousands,
      shared: best.shared,
      place: {
        latitude: round(airport?.latitude ?? place.latitude),
        longitude: round(airport?.longitude ?? place.longitude),
        precision: 'city',
        country: place.country,
        // Keep the carrier's spelling unless it is shouting: "La Crau", but "Köln" for "KOELN".
        name: !place.named && /\p{Ll}/u.test(carrierWords) ? carrierWords : place.name,
        ...(place.site ? { site: place.site } : airport ? { site: airport.name } : {}),
      },
    };
  }
  // A hub named after a city that shares a country's name: GIG Logistics' "BENIN HUB"
  // is in Benin City. On a parcel in the city's country, and not in the named one, the
  // city it is, when it is a large one.
  const facilityWords = tokens(rest);
  if (country && !context.includes(country) && text.endsWith(rest) && facilityWords.length
    && facilityWords.every((token) => FACILITY_WORDS.has(token.key))) {
    const town = locate(text, hints, false);
    if (town?.place.precision === 'city' && context.includes(town.place.country) && (town.thousands ?? 0) >= NAMESAKE_THOUSANDS) return town;
  }
  // A two-letter code with no town of its country before it, on a parcel nothing else puts
  // there, may be no country at all: Royal Mail ends its mail centres with MC and its
  // delivery offices with DO, India's states are written like countries. A town the text
  // names where the parcel is settles it; so does any town, for a code no comma or bracket
  // sets apart. A code of that kind with no town at all is then no place either.
  if (rest && (looseCountry || coded) && !context.includes(country!)) {
    // Past a comma or a bracket, only a town known on its own: no hamlet where the parcel is.
    const town = locate(rest, looseCountry ? hints : { carriers });
    if (town?.place.precision === 'city' && (looseCountry || context.includes(town.place.country))) return town;
    if ((looseCountry || bracketed) && context.length) return null;
  }
  // India Post ends an office's name with its PIN code, and abbreviates some names
  // past reading ("KOL AP TMO 700052"): the PIN's town places a scan that names no
  // town, when the scan or the parcel is in India. A town nothing confirmed is no
  // abbreviation, and its six digits may be a Swiss Post site ("Daillens … 131070").
  const pin = !namesTown && (country === 'IN' || (!country && hinted.includes('IN'))) ? pinPlace(data, rest) : null;
  if (pin) return { place: pin, text: true };
  // A region alone places its country: "Guangdong Province", or "Santa Catarina"
  // on a Brazilian parcel, though Cape Verde has one too.
  // A code nothing backs is a guess: it tells the scans around it nothing.
  const guessed = Boolean(rest) && (looseCountry || bracketed) && !context.includes(country!);
  if (!country) {
    const named = fieldPhrases.flatMap((list) => list.filter((phrase) => phrase.whole && phrase.key.length >= 4
      && !VAGUE_REGIONS.has(phrase.key)).map((phrase) => {
      const all = new Set((data.regions.get(phrase.key) ?? []).map((region) => region.country));
      const local = new Set([...all].filter((code) => hinted.includes(code)));
      return all.size > 1 && local.size ? local : all;
    }));
    country = named.find((set) => set.size === 1)?.values().next().value ?? null;
  }
  const area = country ? data.countries.get(country) : null;
  return area && country
    ? { text: !guessed, place: { latitude: area.latitude, longitude: area.longitude, precision: 'country', country, name: area.name } }
    : null;
}

/**
 * The airport a scan names, near the town it names: by its code in brackets
 * ("Frankfurt Airport (FRA)"), by a word of its own name ("LONDON-HEATHROW"),
 * or as the one airport of the town when the text says airport ("LIEGE AIRPORT").
 * `text` is the location without the country it names, `field` the part of it
 * the town was read from: in "Soyapango, San Salvador" the region is no airport.
 */
function airportFor(data: Gazetteer, text: string, field: string, town: Candidate, written: string, country: string | null): Airport | null {
  const words = new Set(tokens(text).map((token) => token.key));
  const fieldWords = new Set(tokens(field).map((token) => token.key));
  const townWords = new Set([...nameKey(written).split(' '), ...nameKey(town.name).split(' ')]);
  const nearby = [...data.airports.values()].filter((airport) => (!country || airport.country === country)
    && distanceKm(town.latitude, town.longitude, airport.latitude, airport.longitude) <= AIRPORT_MAX_KM);
  for (const [, code] of text.matchAll(/\(([A-Z]{3})\)/g)) {
    const named = nearby.find((airport) => airport.code === code);
    if (named) return named;
  }
  const distinct = nearby.filter((airport) => nameKey(airport.name).split(' ')
    .some((word) => word.length >= 5 && !AIRPORT_NAME_WORDS.has(word) && !townWords.has(word) && fieldWords.has(word)));
  if (distinct.length === 1) return distinct[0]!;
  if (![...words].some((word) => AIRPORT_WORDS.has(word))) return null;
  const serving = nearby.filter((airport) => [...townWords].some((word) => word.length >= 3
    && ` ${nameKey(airport.name)} ${nameKey(airport.town)} `.includes(` ${word} `)));
  return serving.length === 1 ? serving[0]! : null;
}

const round = (value: number) => Math.round(value * 1000) / 1000;

// A station a carrier names by its town's airport code and a number: "BLQ 01", "NAP02".
const STATION = /^([A-Z]{3})[\s_-]?\d{1,2}$/;

/**
 * The town of a station a carrier names by an airport's code and a number, as iMile names its
 * Italian ones ("BLQ 01" would be Bologna's), when the parcel is in the airport's country. A
 * bare code places nothing, and neither does a code whose airport is in a country nothing puts
 * the parcel in: three letters are too often something else.
 */
function stationPlace(data: Gazetteer, text: string, countries: readonly string[], carriers: readonly string[]): Located | null {
  const code = STATION.exec(text)?.[1];
  const airport = code && !FACILITY_WORDS.has(code.toLowerCase()) ? data.airports.get(code) : undefined;
  if (!airport || !countries.includes(airport.country)) return null;
  const town = locate(airport.town, { countries: [airport.country], carriers }, false);
  if (!town || town.place.precision !== 'city' || town.place.country !== airport.country
    || distanceKm(town.place.latitude, town.place.longitude, airport.latitude, airport.longitude) > AIRPORT_MAX_KM) return null;
  return { ...town, text: true };
}

/**
 * The town of the Indian PIN code a scan ends with. A foreign airport's code, alone or
 * after its country's, names an office of exchange abroad ("Office - FRA 400051",
 * "Office - DEFRA …"): the PIN is then the Indian office's, not where the scan happened.
 */
function pinPlace(data: Gazetteer, text: string): EventPlace | null {
  const pin = /(?:^|\s)([1-8]\d{5})$/.exec(text)?.[1];
  // Russian, Chinese and other six-digit postcodes come with their own script.
  if (!pin || /[^\x20-\x7e]/.test(text)) return null;
  for (const [, prefix, code] of text.matchAll(/\b([A-Z]{2})?([A-Z]{3})\b/g)) {
    const airport = FACILITY_WORDS.has(code!.toLowerCase()) ? undefined : data.airports.get(code!);
    if (airport && airport.country !== 'IN' && (!prefix || prefix === airport.country)) return null;
  }
  pincodes ??= JSON.parse(readFileSync(PINCODES, 'utf8')) as Pincodes;
  const { ranges, towns } = pincodes;
  const value = Number(pin);
  let low = 0;
  let high = ranges.length - 1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    const [first, last, town] = ranges[middle]!;
    if (value < first) high = middle - 1;
    else if (value > last) low = middle + 1;
    else {
      const [name, latitude, longitude] = towns[town]!;
      return { latitude, longitude, precision: 'city', country: 'IN', name };
    }
  }
  return null;
}

/** A sorting centre the table knows, by its number and the town its name starts with. */
function facilityPlace(text: string): EventPlace | null {
  const match = /^(.*\S)\s+(\d{6})$/.exec(text);
  const facility = match && FACILITIES.get(`CH:${match[2]}`);
  if (!facility || !`${nameKey(match[1]!)} `.startsWith(`${nameKey(facility.town)} `)) return null;
  const { latitude, longitude, country, town, name } = facility;
  return { latitude, longitude, precision: 'city', country, name: town, ...(name === town ? {} : { site: name }) };
}

/** The carrier's own point in place of the town's centre, when the two agree. */
function atPoint(place: EventPlace | null, point: EventPoint | null | undefined): EventPlace | null {
  if (!place || !point || place.precision !== 'city') return place;
  if (distanceKm(place.latitude, place.longitude, point.latitude, point.longitude) > POINT_MAX_KM) return place;
  return { ...place, latitude: point.latitude, longitude: point.longitude };
}

const cache = new Map<string, Located | null>();
const CACHE_SIZE = 20_000;

function cachedPlace(location: string | null | undefined, countries: readonly string[], carriers: readonly string[]): Located | null {
  const key = `${countries.join(',')}|${carriers.join(',')}|${location ?? ''}`;
  if (cache.has(key)) return cache.get(key)!;
  const place = locate(location, { countries, carriers });
  if (cache.size >= CACHE_SIZE) cache.clear();
  cache.set(key, place);
  return place;
}

/** The countries a carrier delivers in under its own name, home first, and its clock's. */
function carrierHomes(carrier: string): string[] {
  const definition = (CARRIER_DEFINITIONS as Record<string, { countries?: readonly string[]; timezone?: string } | undefined>)[carrier];
  if (!definition) return [];
  const countries = definition.countries ?? [];
  const clock = definition.timezone ? timeZoneCountry(definition.timezone) : null;
  return [...(countries.length <= HOME_COUNTRIES_MAX ? countries : []), ...(clock ? [clock] : [])];
}

/**
 * Places for a parcel's scans, oldest first. A scan that names no country
 * borrows one from the scans around it, then the destination and the
 * carriers' home countries, so "Buchs" after "Zürich" stays in Switzerland.
 * A world city, or a town ten times larger than that country's namesake,
 * keeps its own place when it lies nearer the way between the scans around it.
 * A town only its name places, in a country nothing else puts the parcel in,
 * is a namesake and gets no place when it is thousands of kilometres off the
 * way between the scans around it, or, where the scans stop, that far from
 * them and from the parcel's countries, under a name other towns share,
 * without being a world city. A carrier's own point for a scan, or for
 * another scan with the same text, moves it from the town's centre to the
 * facility, if the two are within 30 km of each other. Given the scans'
 * stages and times, a scan the parcel was not at gets no place (see `awayScans`).
 */
export function placesForEvents(
  locations: readonly (string | null | undefined)[],
  { destinationCountry, carrierCountries = [], carriers = [], points = [], stages = [], times = [] }: {
    destinationCountry?: string | null;
    carrierCountries?: readonly string[];
    /** The parcel's carriers by catalog id, the one delivering now first: their countries and their own hubs. */
    carriers?: readonly string[];
    /** The carrier's own point for each scan, where it gave one. */
    points?: readonly (EventPoint | null | undefined)[];
    /** Each scan's stage, such as `customs`. */
    stages?: readonly (string | null | undefined)[];
    /** When each scan happened, as an ISO 8601 time with its offset. */
    times?: readonly (string | null | undefined)[];
  } = {},
): (EventPlace | null)[] {
  const base = [...new Set([destinationCountry, ...carrierCountries, ...carriers.flatMap(carrierHomes)].filter((code): code is string => Boolean(code)))];
  const first = locations.map((location) => cachedPlace(location, base, carriers));
  // A carrier can place some scans of an office and not others: they all share it.
  const pointAt = new Map<string, EventPoint>();
  locations.forEach((location, index) => {
    const point = points[index];
    if (location && point && !pointAt.has(location.trim())) pointAt.set(location.trim(), point);
  });
  // What holds a scan where it is: its own text, or a country the parcel is known to be in.
  const anchored = (found: Located | null): boolean => found !== null && (found.text || base.includes(found.place.country));
  const reach = (from: EventPlace, to: EventPlace) => from.precision === 'country'
    ? countryDistanceKm(from.country, to.latitude, to.longitude)
    : distanceKm(from.latitude, from.longitude, to.latitude, to.longitude);
  // The nearest scan before (`step` -1) or after another that `holds`.
  const nearest = (list: readonly (Located | null)[], index: number, step: number, holds: (entry: Located | null, at: number) => boolean): Located | null => {
    for (let at = index + step; at >= 0 && at < list.length; at += step) if (holds(list[at]!, at)) return list[at]!;
    return null;
  };
  // The scans a town's name alone places, where the scans around them say it is a namesake.
  const namesakes = (list: readonly (Located | null)[]): Set<number> => {
    const found = new Set<number>();
    const lone = list.flatMap((entry, index) => entry && !anchored(entry) && entry.place.precision === 'city' ? [{ ...entry, index }] : []);
    // A name says where a town is when no other town shares it, or when it is a world city's.
    const known = (entry: { thousands?: number; shared?: boolean }) => !entry.shared || (entry.thousands ?? 0) >= WORLD_CITY_THOUSANDS;
    const judge = (entries: typeof lone, holds: (entry: Located | null, index: number) => boolean) => {
      for (const { place, index, ...entry } of entries) {
        const before = nearest(list, index, -1, holds)?.place;
        const after = nearest(list, index, 1, holds)?.place;
        const around = [before, after].filter((other): other is EventPlace => Boolean(other));
        if (around.some((other) => other.country === place.country)) continue;
        if (before && after) {
          const detour = reach(before, place) + reach(after, place) - distanceKm(before.latitude, before.longitude, after.latitude, after.longitude);
          if (detour > DETOUR_MAX_KM) found.add(index);
        } else if (base.length && !known(entry) && around.every((other) => reach(other, place) > LEAP_MAX_KM)
          && base.every((code) => countryDistanceKm(code, place.latitude, place.longitude) > LEAP_MAX_KM)) {
          found.add(index);
        }
      }
    };
    // Such a town stands among the scans that hold, and the towns around it are judged by it too.
    judge(lone.filter(known), anchored);
    judge(lone.filter((entry) => !known(entry)), (entry, index) => entry !== null
      && (anchored(entry) || (entry.place.precision === 'city' && known(entry) && !found.has(index))));
    return found;
  };
  // A namesake tells its neighbours nothing, and neither does a country guessed from a code nothing backs.
  const doubtful = namesakes(first);
  const telling = (found: Located | null, index: number): boolean =>
    found !== null && !doubtful.has(index) && (found.text || found.place.precision === 'city');
  // A world city, or a town far larger than its namesake, keeps its own place over one in a
  // country the parcel is in when it lies nearer the way between the scans around it:
  // "Warsaw" between Lviv and New York is in Poland.
  const ownPlace = (location: string, found: Located | null, index: number): Located | null => {
    if (!found || found.text || found.place.precision !== 'city') return found;
    const other = (entry: Located | null, at: number) => telling(entry, at) && locations[at]?.trim() !== location.trim();
    const before = nearest(first, index, -1, other)?.place;
    const after = nearest(first, index, 1, other)?.place;
    const alone = before && after ? cachedPlace(location, [], carriers) : null;
    if (!before || !after || !alone || alone.place.precision !== 'city' || alone.place.country === found.place.country) return found;
    const thousands = alone.thousands ?? 0;
    if (thousands < WORLD_CITY_THOUSANDS && (thousands < NAMESAKE_THOUSANDS || thousands < DOMINANT_TIMES * (found.thousands ?? 0))) return found;
    const way = (place: EventPlace) => reach(before, place) + reach(after, place);
    return way(alone.place) < way(found.place) ? alone : found;
  };
  const settled = locations.map((location, index) => {
    if (!location?.trim()) return null;
    const before = nearest(first, index, -1, telling)?.place.country;
    const after = nearest(first, index, 1, telling)?.place.country;
    const neighbours = [...new Set([before, after].filter((code): code is string => Boolean(code)))];
    if (!neighbours.length || neighbours.every((code) => base.includes(code))) return ownPlace(location, first[index]!, index);
    return ownPlace(location, cachedPlace(location, [...neighbours, ...base.filter((code) => !neighbours.includes(code))], carriers)
      ?? (telling(first[index]!, index) ? first[index]! : null), index);
  });
  const dropped = namesakes(settled);
  const places = locations.map((location, index) => {
    const found = settled[index];
    if (!found || !location || dropped.has(index)) return null;
    return atPoint(found.place, points[index] ?? pointAt.get(location.trim()));
  });
  if (!stages.length) return places;
  const away = awayScans(places, stages, times);
  return places.map((place, index) => away.has(index) ? null : place);
}
