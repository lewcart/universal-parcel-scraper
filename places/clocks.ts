/**
 * Instants for the scans a carrier gives on a wall clock in no stated zone
 * (`local_time`). The zone is deduced, so it can be wrong; the scan keeps its
 * wall clock and says how its zone was chosen.
 */
import { DateTime, IANAZone } from 'luxon';
import { CARRIER_DEFINITIONS } from '../core/catalog/definitions.js';
import type { CarrierEvent, CarrierResult } from '../core/result/index.js';
import { EXPLICIT_OFFSET_PATTERN, firstOccurrence } from '../core/time/index.js';
import { airportTimeZone, placesForEvents, placeTimeZone, type EventPlace } from './index.js';
import { mainZone } from './zones.js';

/**
 * How a deduced zone was chosen: the scan's own place; the place of the
 * nearest scan that has one; the parcel's destination, where the carrier
 * delivers; the carrier's home clock.
 */
export type ZoneBasis = 'place' | 'neighbour' | 'destination' | 'carrier';

const WALL_CLOCK = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/;

const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';

function instant(value: unknown): number | null {
  const raw = text(value);
  if (!EXPLICIT_OFFSET_PATTERN.test(raw)) return null;
  const parsed = DateTime.fromISO(raw, { setZone: true });
  return parsed.isValid ? parsed.toMillis() : null;
}

/** A scan with a time of day on its wall clock alone. */
const walled = (event: CarrierEvent): boolean => !text(event.time) && WALL_CLOCK.test(text(event.local_time));

type Definition = { countries?: readonly string[]; timezone?: string };
const definition = (carrier: string): Definition | undefined => (CARRIER_DEFINITIONS as Record<string, Definition | undefined>)[carrier];

/**
 * The carrier's home clock: the zone its result declares, else its catalog
 * zone, or with UTC there, its first country's. A host can start a scan the
 * carrier dates by its day alone at midnight there. Null for a carrier the
 * catalog places nowhere.
 */
export function carrierHomeZone(carrier: string, result: Pick<CarrierResult, 'timezone'> = {}): string | null {
  const declared = text(result.timezone);
  if (declared && IANAZone.isValidZone(declared)) return declared;
  const { timezone, countries = [] } = definition(carrier) ?? {};
  if (timezone && timezone !== 'UTC' && IANAZone.isValidZone(timezone)) return timezone;
  return countries[0] ? mainZone(countries[0]) : null;
}

/** The destination's clock, when the carrier delivers there itself. */
function destinationZone(carrier: string, country: string): string | null {
  return country && (definition(carrier)?.countries ?? []).includes(country) ? mainZone(country) : null;
}

/**
 * Dates each scan that has a wall clock and no instant. The zone comes
 * from the scan's place, read with the scans around it, or an airport its
 * code alone names; else from the nearest scan that has a place; else from the destination, if the carrier
 * delivers there; else from the carrier's home clock. A place that names only
 * a country with several zones, and none of its states, borrows the zone of a
 * town in that country from the nearest scan that names one. The scan keeps `local_time` and gains
 * `time`, `time_zone` and `time_zone_basis`. `last_update_local` gives a
 * missing `last_update` the same way. Scans dated by their day alone and
 * offset-less `time` values are left as they are.
 */
export function dateLocalClocks(carrier: string, result: CarrierResult): CarrierResult {
  const events = result.events ?? [];
  const latestLocal = text(result.last_update_local);
  const latestMissing = instant(result.last_update) === null && WALL_CLOCK.test(latestLocal);
  if (!events.some(walled) && !latestMissing) return result;
  // Places read the scans oldest first. Carriers list them one way or the other.
  const clock = (event: CarrierEvent) => instant(event.time) ?? (Date.parse(`${text(event.local_time)}Z`) || null);
  const dated = events.map(clock).filter((value): value is number => value !== null);
  const newestFirst = dated.length > 1 && dated[0]! > dated[dated.length - 1]!;
  const order = events.map((_, index) => newestFirst ? events.length - 1 - index : index);
  const scans = order.map((index) => events[index]!);
  const places = placesForEvents(scans.map((event) => text(event.location) || null), {
    destinationCountry: text(result.destination_country).toUpperCase() || null,
    carriers: [carrier],
    points: scans.map((event) => event.point),
    stages: scans.map((event) => text(event.stage) || null),
    times: scans.map((event) => instant(event.time) === null ? null : text(event.time)),
  });
  const placed = places.map((place) => place && (place.precision === 'city' || place.region) ? placeTimeZone(place) : null);
  // The nearest scan with a zone of its own, the earlier one on a tie.
  const nearest = (at: number, fits: (place: EventPlace) => boolean): string | null => {
    for (let step = 1; step < scans.length; step += 1) {
      for (const other of [at - step, at + step]) {
        const place = places[other];
        if (place && placed[other] && fits(place)) return placed[other];
      }
    }
    return null;
  };
  const destination = destinationZone(carrier, text(result.destination_country).toUpperCase());
  const home = carrierHomeZone(carrier, result);
  const zoneAt = (at: number): { zone: string; basis: ZoneBasis } | null => {
    const place = places[at];
    if (placed[at]) return { zone: placed[at], basis: 'place' };
    if (place) {
      const town = nearest(at, (other) => other.country === place.country);
      const zone = town ?? placeTimeZone(place);
      if (zone) return { zone, basis: town ? 'neighbour' : 'place' };
    }
    const airport = airportTimeZone(text(scans[at]!.location));
    if (airport) return { zone: airport, basis: 'place' };
    const borrowed = nearest(at, () => true);
    if (borrowed) return { zone: borrowed, basis: 'neighbour' };
    if (destination) return { zone: destination, basis: 'destination' };
    return home ? { zone: home, basis: 'carrier' } : null;
  };
  const zones = new Map<CarrierEvent, { zone: string; basis: ZoneBasis }>();
  scans.forEach((event, at) => {
    if (!walled(event)) return;
    const zone = zoneAt(at);
    if (zone) zones.set(event, zone);
  });
  const at = (local: string, zone: string) =>
    firstOccurrence(DateTime.fromISO(local, { zone })).toISO({ suppressMilliseconds: true });
  const dates = events.map((event) => {
    const zone = zones.get(event);
    const time = zone && at(text(event.local_time), zone.zone);
    return zone && time ? { ...event, time, time_zone: zone.zone, time_zone_basis: zone.basis } : event;
  });
  // The scan showing the newest clock, else the newest scan dated here (`zones` runs oldest first).
  const shown = events.find((event) => text(event.local_time) === latestLocal);
  const latestZone = !latestMissing ? undefined
    : (shown && zones.get(shown)) ?? [...zones.values()].at(-1) ?? (home ? { zone: home, basis: 'carrier' as const } : undefined);
  const latest = latestZone && at(latestLocal, latestZone.zone);
  return { ...result, ...(result.events ? { events: dates } : {}), ...(latest ? { last_update: latest } : {}) };
}
