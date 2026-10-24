import { translatedScanPolicy } from '../../core/status/english.js';
import { jrtEnglish } from './status.js';

// Rows stored in JRT's Chinese before the adapter showed their English are
// taken over by the English row at the same instant and place.
export const sameInstantIdentityPolicy = translatedScanPolicy('jrt', (wording) => jrtEnglish(null, wording));
