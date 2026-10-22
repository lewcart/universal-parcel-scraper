import { describe, expect, it, vi } from 'vitest';
import type { CarrierEvent } from '../core/result/index.js';
import { airportTimeZone, carrierHomeZone, dateLocalClocks, locatePlace, placeTimeZone } from './index.js';

vi.setConfig({ testTimeout: 30_000 });

const zoneOf = (location: string) => placeTimeZone(locatePlace(location)!);
const dated = (event: CarrierEvent | undefined) => event && [event.time, event.time_zone, event.time_zone_basis];

describe('placeTimeZone', () => {
  it('reads a country of one clock, a state or province, or the nearest zone of a large country', () => {
    expect(zoneOf('Leipzig/Halle Hub')).toBe('Europe/Berlin');
    expect(zoneOf('Changsha')).toBe('Asia/Shanghai');
    expect(zoneOf('Dallas TX')).toBe('America/Chicago');
    expect(zoneOf('PERRIS, CA')).toBe('America/Los_Angeles');
    expect(zoneOf('Brisbane, AU')).toBe('Australia/Brisbane');
    expect(zoneOf('Manaus')).toBe('America/Manaus');
    expect(zoneOf('Tijuana')).toBe('America/Tijuana');
    expect(zoneOf('Las Palmas de Gran Canaria')).toBe('Atlantic/Canary');
    expect(zoneOf('Ponta Delgada')).toBe('Atlantic/Azores');
  });

  it('gives a country with several zones named alone the zone most of its people live on', () => {
    expect(zoneOf('UNITED STATES')).toBe('America/New_York');
  });

  it('reads an airport its code alone names, which places nothing on a map', () => {
    expect(locatePlace('AMS')).toBeNull();
    expect(airportTimeZone('AMS')).toBe('Europe/Amsterdam');
    expect(airportTimeZone('Ams')).toBeNull();
  });
});

describe('dateLocalClocks', () => {
  it('dates scans by their place, else by the nearest scan with one, the earlier on a tie', () => {
    const result = dateLocalClocks('china-post', { status: 'delivered', last_update_local: '2026-10-20T09:00:00', events: [
      { local_time: '2026-10-20T09:00:00', description: 'Delivered', stage: 'delivered' },
      { local_time: '2026-10-19T18:00:00', description: 'Out for delivery', location: 'Madrid' },
      { local_time: '2026-10-18T03:00:00', description: 'Departed' },
      { local_time: '2026-10-15T10:00:00', description: 'Posted', location: '广州' },
    ] });
    expect(result.events!.map(dated)).toEqual([
      ['2026-10-20T09:00:00+02:00', 'Europe/Madrid', 'neighbour'],
      ['2026-10-19T18:00:00+02:00', 'Europe/Madrid', 'place'],
      ['2026-10-18T03:00:00+08:00', 'Asia/Shanghai', 'neighbour'],
      ['2026-10-15T10:00:00+08:00', 'Asia/Shanghai', 'place'],
    ]);
    expect(result.events![0]!.local_time).toBe('2026-10-20T09:00:00');
    expect(result.last_update).toBe('2026-10-20T09:00:00+02:00');
  });

  it('reads scans listed oldest first the same way', () => {
    const result = dateLocalClocks('china-post', { status: 'in_transit', events: [
      { local_time: '2026-10-15T10:00:00', description: 'Posted', location: '广州' },
      { local_time: '2026-10-19T18:00:00', description: 'Arrived', location: 'Madrid' },
      { local_time: '2026-10-20T09:00:00', description: 'Sorted' },
    ] });
    expect(result.events!.map((event) => event.time_zone)).toEqual(['Asia/Shanghai', 'Europe/Madrid', 'Europe/Madrid']);
  });

  it('takes a town of the same country around a scan that names only a country with several zones', () => {
    const result = dateLocalClocks('gofo', { status: 'in_transit', events: [
      { local_time: '2026-10-20T09:00:00', description: 'Arrived', location: 'UNITED STATES' },
      { local_time: '2026-10-19T18:00:00', description: 'Sorted', location: 'PERRIS, CA' },
    ] });
    expect(dated(result.events![0])).toEqual(['2026-10-20T09:00:00-07:00', 'America/Los_Angeles', 'neighbour']);
  });

  it('falls back to the destination the carrier delivers in, then to its home clock', () => {
    const scan = { local_time: '2026-03-02T11:00:00', description: 'In transit' };
    expect(dated(dateLocalClocks('mailamericas', { destination_country: 'EC', events: [scan] }).events![0]))
      .toEqual(['2026-03-02T11:00:00-05:00', 'America/Guayaquil', 'destination']);
    expect(dated(dateLocalClocks('seur', { events: [scan] }).events![0]))
      .toEqual(['2026-03-02T11:00:00+01:00', 'Europe/Madrid', 'carrier']);
    // A catalog zone of UTC says the feed mixes clocks: the home is the carrier's first country.
    expect(dated(dateLocalClocks('china-post', { events: [scan] }).events![0]))
      .toEqual(['2026-03-02T11:00:00+08:00', 'Asia/Shanghai', 'carrier']);
  });

  it('gives a carrier’s home clock: the zone its result declares, its catalog zone, or with UTC there its first country’s', () => {
    expect(carrierHomeZone('seur')).toBe('Europe/Madrid');
    expect(carrierHomeZone('usps')).toBe('America/New_York');
    expect(carrierHomeZone('china-post')).toBe('Asia/Shanghai');
    expect(carrierHomeZone('usps', { timezone: 'America/Chicago' })).toBe('America/Chicago');
    expect(carrierHomeZone('usps', { timezone: 'Not/AZone' })).toBe('America/New_York');
    expect(carrierHomeZone('unknown')).toBeNull();
  });

  it('reads a wall clock the clocks repeat as its first occurrence', () => {
    const result = dateLocalClocks('seur', { events: [{ local_time: '2026-10-25T02:30:00', description: 'Sorted' }] });
    expect(result.events![0]!.time).toBe('2026-10-25T02:30:00+02:00');
  });

  it('leaves instants, offset-less times and scans dated by their day alone as they are', () => {
    const events: CarrierEvent[] = [
      { time: '2026-03-02T11:00:00+01:00', description: 'Delivered', location: 'Madrid' },
      { time: '2026-03-02T09:00:00', description: 'Out for delivery' },
      { local_time: '2026-03-01', description: 'Sorted' },
    ];
    const result = { status: 'delivered' as const, last_update: '2026-03-02T11:00:00+01:00', events };
    expect(dateLocalClocks('seur', result)).toBe(result);
  });
});
