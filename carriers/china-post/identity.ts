import { translatedScanPolicy } from '../../core/status/english.js';
import { chinaPostEnglish } from './status.js';

// Rows stored in China Post's Chinese label before the adapter showed its English
// are taken over by the English row at the same instant and place.
export const sameInstantIdentityPolicy = translatedScanPolicy('china-post', chinaPostEnglish);
