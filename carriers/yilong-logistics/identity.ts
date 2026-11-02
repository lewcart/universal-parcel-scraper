import { hualeiIdentityPolicy } from '../gzyl/identity.js';

// Rows stored at the tracker's "SYSTEM" or "Delivery Location" are taken over by the same rows without a place.
export const sameInstantIdentityPolicy = hualeiIdentityPolicy('yilong-logistics');
