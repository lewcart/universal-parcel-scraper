import { describe, expect, it } from 'vitest';
import { NOOP_RECORDER } from '../../core/telemetry/index.js';
import { createTracker } from '../../facade/index.js';
import { adapter } from './adapter.js';

const direct = () => adapter({ recorder: NOOP_RECORDER, env: {}, trawl: null, browserExecutablePath: null });

describe('iMile live retrieval', () => {
  it.skipIf(!process.env.IMILE_TRACKING_NUMBER)('retrieves the history of the requested parcel with providers disabled', async () => {
    const answer = await createTracker({ providers: [] }).track({ number: process.env.IMILE_TRACKING_NUMBER!, carrier: 'imile' });
    expect(answer).toMatchObject({ carrier: 'imile', source: 'imile' });
    expect(answer.attempts[0]).toMatchObject({ source: 'imile', kind: 'ok' });
    expect(answer.result.events.length).toBeGreaterThan(0);
    // Every scan keeps the recipient country's wall clock, without an offset.
    expect(answer.result.events.every((event) => event.description && !event.time
      && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(String(event.local_time)))).toBe(true);
    // Most scans carry a stage code; a few come without one.
    expect(answer.result.events.some((event) => event.provider_code)).toBe(true);
  }, 75_000);

  it.skipIf(!process.env.IMILE_UNKNOWN_NUMBER)('reads an unknown number as not found after checking the page’s key', async () => {
    await expect(direct().track({ number: process.env.IMILE_UNKNOWN_NUMBER! })).rejects.toMatchObject({ kind: 'not_found' });
  }, 75_000);
});
