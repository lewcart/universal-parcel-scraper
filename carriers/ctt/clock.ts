import { countryTimeZone, regionHasTown } from '../../core/time/index.js';

/**
 * CTT's clocks. CTT dates a scan with the wall clock of the place it happened
 * and writes it with a Z: its tracker is an OutSystems app, whose DateTime
 * values travel as UTC strings, and its page shows the digits as they are
 * whatever the viewer's zone. UPU's tracking has the same wall clocks for
 * CTT's posting and dispatch, and 17TRACK reads them on Lisbon's clock
 * (checked 2026-10-10). The destination post's scans keep its own wall clock:
 * an Italian delivery comes at the Italian office's time. So do the origin
 * post's scans of mail from abroad.
 */

/** A UPU office of exchange leading a location: "PTLISA - (OUTRO) LISBOA". */
const OFFICE = /^([A-Z]{2})[A-Z0-9]{4}(?=\s+-\s)/;
/** CTT's own sites: a sorting or delivery centre (CDP), a shop or a postal point. */
const CTT_SITE = /\b(?:CTT|CDP|centro operacional|centro de distribui[cç][aã]o)\b/i;
/** A Portuguese postcode; 9500 to 9999 are the Azores. */
const POSTCODE = /(?<!\d)(\d{4})(?:-\d{3})?(?!\d)/;

/**
 * The clock of a scan in Portugal: the Azores keep one an hour behind the
 * mainland and Madeira. A location names them by postcode or by a town only
 * the islands have.
 */
export function portugalZone(location: string): string {
  const postcode = POSTCODE.exec(location)?.[1];
  if (postcode) return Number(postcode) >= 9500 ? 'Atlantic/Azores' : 'Europe/Lisbon';
  const town = location.replace(OFFICE, '').replace(/\([^)]*\)/g, ' ').replace(/^[\s\d-]+/, '')
    .replace(/\b(?:loja|ponto|centro operacional|CTT|CDP)\b/gi, ' ').replace(/\s+/g, ' ').trim();
  return town && regionHasTown('PT-20', town) ? 'Atlantic/Azores' : 'Europe/Lisbon';
}

/**
 * The clock a CTT scan's location itself names: the country of the office of
 * exchange leading it, when that is Portugal or one of `countries` (the
 * parcel's), else Portugal's for one of CTT's own sites. Null when the
 * location does not say.
 */
export function cttSiteZone(location: string, countries: readonly (string | null)[]): string | null {
  const office = OFFICE.exec(location)?.[1];
  if (office === 'PT' || (office && countries.includes(office))) {
    return office === 'PT' ? portugalZone(location) : countryTimeZone(office);
  }
  return CTT_SITE.test(location) ? portugalZone(location) : null;
}
