import type { SameInstantIdentityPolicy } from '../../core/catalog/eventIdentity.js';
import { translatedScanPolicy } from '../../core/status/english.js';
import { matchesRereadText } from '../gzyl/identity.js';
import { jrtEnglish } from './status.js';

// Rows stored in JRT's Chinese before the adapter showed their English, and
// the airport row stored with the flight it books, are taken over by the
// English row at the same instant and place; a row stored with a space GBK
// lost, by the same row with the space.
const translated = translatedScanPolicy('jrt', (wording) => jrtEnglish(null, wording));
export const sameInstantIdentityPolicy: SameInstantIdentityPolicy = {
  ...translated, matches: (incoming, stored) => translated.matches!(incoming, stored) || matchesRereadText(incoming, stored),
};
