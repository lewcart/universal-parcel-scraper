import { accepted, recognizeFromLookup, type AdapterFactory } from '../../core/adapter/index.js';
import { HualeiTracker } from '../gzyl/hualei.js';
import { JRT, normalizeJrtNumber } from './parser.js';

export class JrtTracker extends HualeiTracker {
  constructor(options: ConstructorParameters<typeof HualeiTracker>[1] = {}) { super(JRT, options); }
}

export const adapter: AdapterFactory = (environment) => {
  const tracker = new JrtTracker({ fetcher: environment.fetcher, recorder: environment.recorder, userAgent: environment.userAgent });
  return {
    id: 'jrt', recordsSteps: true, steps: ['direct', 'retry'],
    track: (input, context) => tracker.fetch(input.number, context),
    recognize: (number, context) => recognizeFromLookup(() => tracker.fetch(number, context), () => accepted(() => normalizeJrtNumber(number))),
  };
};
