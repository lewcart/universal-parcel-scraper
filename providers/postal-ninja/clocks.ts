/**
 * The clocks of Postal Ninja's services, by the name it gives each scan's
 * service (`ds`). Its `dt` names no zone, and it is not always the scanning
 * office's wall clock: Postal Ninja keeps some services in UTC and others in
 * their home zone wherever the scan happened. Each entry was established on
 * benchmark parcels against the carrier's own instants (its adapter's offsets
 * or epoch times, or its website); README.md gives the evidence. A service
 * missing here has no known clock: its scans borrow a zone in the adapter, as
 * a guess, or keep their wall time.
 */
import { CARRIER_DEFINITIONS } from '../../core/catalog/definitions.js';
import { canadaProvinceTimeZone, countryCode, countryTimeZone, sharedClockZone, usStateTimeZone } from '../../core/time/index.js';
import { courierZone } from '../shared/hints.js';

/** Services whose every scan is at one clock, wherever it happened and whatever other services the history names. */
const FIXED_CLOCKS: ReadonlyMap<string, string> = new Map([
  ['Austrian Post', 'UTC'],
  ['Intelcom', 'UTC'],
  ['OnTrac', 'UTC'],
  ['Poste Italiane', 'UTC'],
  // Also for their scans abroad: Swiss Post's in El Salvador and China, Singapore Post's in China.
  ['Singapore Post', 'Asia/Singapore'],
  ['Swiss Post', 'Europe/Zurich'],
]);

/** Services with one clock per network, by the parcel's destination: GOFO's US network keeps Los Angeles time in New York. */
const NETWORK_CLOCKS: ReadonlyMap<string, ReadonlyMap<string, string>> = new Map([
  ['GOFO Express', new Map([['US', 'America/Los_Angeles'], ['FR', 'Europe/Paris']])],
]);

/**
 * Services that date a scan at the scanning office's wall clock. Beside other
 * services they can relay a scan at another clock (PostNord gives PostNL's
 * Dutch scans four hours ahead), so they are placed only in a history they
 * report alone within one country.
 */
const LOCAL_CLOCKS: ReadonlySet<string> = new Set([
  'An Post Ireland', 'CTT Express', 'Correos de España', 'DHL Parcel Netherlands', 'DPD', 'DPD Poland', 'DPD UK', 'GLS',
  'Hermes Germany', 'MRW', 'Nova Poshta', 'Packeta', 'Poczta Polska', 'PostNord', 'Posten Norge', 'UkrPoshta',
]);

/**
 * Services on the scanning office's clock across zones, which only the scan's
 * location names: placed by it in a history they report alone. A US state or
 * Canadian province with several zones is read in its majority zone, as Ship24
 * and ParcelsApp read theirs.
 */
const LOCATED_CLOCKS: ReadonlySet<string> = new Set(['FedEx', 'UPS']);
/**
 * Services whose scans between midnight and 1 a.m. reach Postal Ninja twelve
 * hours late: UPS's arrival in Lenexa at 00:25 is dated 12:25. A scan they
 * date 12:xx may be either, except a delivery, which is read as afternoon.
 */
const TWELVE_HOUR_CLOCKS: ReadonlySet<string> = new Set(['UPS']);

/** A scan dated without a time is written as midnight (FedEx's pickup, Geodis's departure). */
const MIDNIGHT = /T00:00(?::00)?$/;
const POSTAL_CODE = /^(?:\d{5}(?:-\d{4})?|[A-Z]\d[A-Z] ?\d[A-Z]\d)$/i;

/** What the reply says about where the parcel's scans happened. */
export interface Journey {
  number: string;
  /** The parcel's destination country (`track.destCn`). */
  destination: string | null;
  /** Whether one service reports the full history and, for a postal item, its origin is its destination. */
  alone: boolean;
  /** The zone routing passes for the parcel's carrier, else `carrierHomeZone`'s. */
  fallback: string | null;
}

/**
 * The zone of the one country a catalog carrier serves (BRT's Italy), for a
 * carrier whose catalog zone is the UTC placeholder. Only scans of a service
 * with a local clock are read in it: a carrier's home is no clock for the
 * services Postal Ninja keeps in UTC (Poste Italiane), nor for the
 * cross-border consolidators the catalog files under China. Null for a
 * carrier serving several countries or none, and for unknown ids.
 */
export function carrierHomeZone(carrier: string | null): string | null {
  const definition = carrier && Object.hasOwn(CARRIER_DEFINITIONS, carrier)
    ? CARRIER_DEFINITIONS[carrier as keyof typeof CARRIER_DEFINITIONS] : undefined;
  const countries = definition?.countries ?? [];
  return countries.length === 1 ? countryTimeZone(countries[0]) : null;
}

/**
 * The clock of a scan location that ends with its country: a US state or
 * Canadian province before it ("Atlanta, GA, United States", "TACOMA, WA,
 * 98424, United States"), or a country with one clock. A two-letter country
 * other than the US's could be a state ("Chicago, IL"), so it names none.
 */
function locationZone(location: string): string | null {
  const parts = location.split(',').map((part) => part.trim()).filter((part) => part && !POSTAL_CODE.test(part));
  const last = parts.at(-1) ?? '';
  const country = parts.length > 1 && (last.length > 2 || /^us$/i.test(last)) ? countryCode(last) : null;
  if (country === 'US') return parts.length === 3 ? usStateTimeZone(parts[1]) : null;
  if (country === 'CA') return parts.length === 3 ? canadaProvinceTimeZone(parts[1]) : null;
  return countryTimeZone(country);
}

/** A scan as the reply gives it. */
export interface Scan {
  /** Postal Ninja's name for the service that reported it (`ds`). */
  service: string;
  /** Its `dt`, without a zone. */
  wall: string;
  location: string;
  delivered: boolean;
}

/**
 * The established zone of a scan's wall time, from the service that reported
 * it: its fixed or network clock in any history, else in a history it reports
 * alone its location's clock, or a local clock's country: the destination's,
 * else the service's (`courierZone`) or the carrier's. A destination on another
 * clock than the service's may be a parcel that crossed a border, so it
 * establishes none. Null when the clock is unknown; false when the hour is
 * (a date written as midnight, UPS's 12:xx), so that no zone can place the
 * scan.
 */
export function serviceZone({ service, wall, location, delivered }: Scan, journey: Journey): string | null | false {
  const fixed = FIXED_CLOCKS.get(service) ?? (journey.destination ? NETWORK_CLOCKS.get(service)?.get(journey.destination) : undefined);
  if (fixed) return fixed;
  if (MIDNIGHT.test(wall) || (TWELVE_HOUR_CLOCKS.has(service) && wall.slice(11, 13) === '12' && !delivered)) return false;
  if (!journey.alone) return null;
  if (LOCATED_CLOCKS.has(service)) return locationZone(location);
  if (!LOCAL_CLOCKS.has(service)) return null;
  const home = courierZone(service, journey.number, wall) ?? journey.fallback;
  if (!journey.destination) return home;
  const destination = countryTimeZone(journey.destination);
  return destination && (!home || sharedClockZone([destination, home], wall)) ? destination : null;
}
