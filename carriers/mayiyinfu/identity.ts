import type { SameInstantIdentityPolicy } from '../../core/catalog/eventIdentity.js';
import { translatedScanPolicy } from '../../core/status/english.js';
import { matchesRereadText } from '../gzyl/identity.js';
import { mayiyinfuEnglish } from './status.js';

// A flight row stored with the day it expects is taken over by its step's
// English at the same instant and place; a row stored with a space GBK lost,
// by the same row with the space.
const translated = translatedScanPolicy('mayiyinfu', (wording) => mayiyinfuEnglish(null, wording));
export const sameInstantIdentityPolicy: SameInstantIdentityPolicy = {
  ...translated, matches: (incoming, stored) => translated.matches!(incoming, stored) || matchesRereadText(incoming, stored),
};
