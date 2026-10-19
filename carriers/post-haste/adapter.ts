import type { AdapterFactory } from '../../core/adapter/index.js';
import { FreightwaysTracker, freightwaysApi } from '../nz-couriers/adapter.js';
import { POST_HASTE } from './parser.js';

/**
 * The Freightways lookup under Post Haste's name, which Post Haste's receiver
 * site script carries. The tracking page on posthaste.co.nz asks it through
 * its web agency's proxy.
 */
export const POST_HASTE_API = freightwaysApi(POST_HASTE);

export class PostHasteTracker extends FreightwaysTracker {
  constructor(options: ConstructorParameters<typeof FreightwaysTracker>[1] = {}) { super(POST_HASTE, options); }
}

export const adapter: AdapterFactory = (environment) => {
  const tracker = new PostHasteTracker({ fetcher: environment.fetcher, recorder: environment.recorder, userAgent: environment.userAgent });
  return {
    id: 'post-haste', recordsSteps: true, steps: ['direct'],
    track: (input, context) => tracker.fetch(input.number, context),
  };
};
