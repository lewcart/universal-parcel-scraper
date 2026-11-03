import { describe, expect, it } from 'vitest';
import { NOOP_RECORDER } from '../../core/telemetry/index.js';
import { createTracker } from '../../facade/index.js';
import { adapter } from './adapter.js';

const direct = () => adapter({ recorder: NOOP_RECORDER, env: {}, trawl: null, browserExecutablePath: null });

describe('WooliiPorter live retrieval', () => {
  it.skipIf(!process.env.WOOLIIPORTER_TRACKING_NUMBER)('retrieves the history of the requested number with providers disabled', async () => {
    const answer = await createTracker({ providers: [] }).track({ number: process.env.WOOLIIPORTER_TRACKING_NUMBER!, carrier: 'wooliiporter' });
    expect(answer).toMatchObject({ carrier: 'wooliiporter', source: 'wooliiporter' });
    expect(answer.attempts[0]).toMatchObject({ source: 'wooliiporter', kind: 'ok' });
    expect(answer.result.events.length).toBeGreaterThan(0);
    expect(answer.result.events.every((event) => event.description
      && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/.test(String(event.time)))).toBe(true);
  }, 30_000);

  // The page's own example number, which the service does not know.
  it('reads the page\'s example number as not found', async () => {
    await expect(direct().track({ number: 'WP1000000000009' })).rejects.toMatchObject({ kind: 'not_found' });
  }, 30_000);
});
