import type { SameInstantIdentityPolicy, SameInstantScan } from '../../core/catalog/eventIdentity.js';
import { matchesDroppedLocation } from '../../core/catalog/locationIdentity.js';
import { translatedScanPolicy } from '../../core/status/english.js';
import { jsExpressEnglish } from './status.js';

/** Who took a parcel iMile delivered, in 【】 after its delivery: ", Receiver Type:【Family】". The parser cuts it. */
export const IMILE_RECEIVER = /\s*[,，;；]?\s*\bReceiver Type\s*[:：]?\s*【[^】]*】/gi;
/** What the tracker prints for a partner's place it holds as a list. The parser drops it. */
export const LIST_PLACE = 'Array';

const normalized = (value: string) => value.replace(/\s+/g, ' ').trim().toLocaleLowerCase('en-US');
const sameWording = (incoming: string, stored: string) => Boolean(normalized(incoming)) && normalized(incoming) === normalized(stored);

// Rows stored in the carrier's Chinese before the adapter showed their English
// are taken over by the English row at the same instant and place.
const translated = translatedScanPolicy('js-express', jsExpressEnglish);

export const sameInstantIdentityPolicy: SameInstantIdentityPolicy = {
  ...translated,
  // A row stored with a label that names no place, without a letter as the parser reads it, is
  // taken over by the row without it. So is one stored at the tracker's "Array", whatever stage
  // the map has given its wording since, and an iMile delivery stored with its receiver type.
  matches: (incoming, stored) => translated.matches!(incoming, stored)
    || matchesDroppedLocation(incoming, stored, (location) => !/\p{L}/u.test(location))
    || listPlace(incoming, stored) || receiverCut(incoming, stored),
};

function listPlace(incoming: SameInstantScan, stored: SameInstantScan): boolean {
  return stored.location.trim() === LIST_PLACE && !incoming.location.trim() && sameWording(incoming.description, stored.description);
}

function receiverCut(incoming: SameInstantScan, stored: SameInstantScan): boolean {
  const cut = stored.description.replace(IMILE_RECEIVER, '');
  return cut !== stored.description && normalized(incoming.location) === normalized(stored.location)
    && incoming.stage === stored.stage && sameWording(incoming.description, cut);
}
