import { describe, expect, it } from 'vitest';
import { NOOP_RECORDER } from '../../core/telemetry/index.js';
import { createTracker } from '../../facade/index.js';
import { adapter } from './adapter.js';

const direct = () => adapter({ recorder: NOOP_RECORDER, env: {}, trawl: null, browserExecutablePath: null });
const WALL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00$/;

describe('GlobalPost live retrieval', () => {
  it.skipIf(!process.env.GLOBALPOST_TRACKING_NUMBER)('retrieves the history of the requested parcel as wall clocks', async () => {
    const result = await direct().track({ number: process.env.GLOBALPOST_TRACKING_NUMBER! });
    expect(result.events!.length).toBeGreaterThan(0);
    expect(result.events!.every((event) => event.description && WALL.test(String(event.local_time)) && !event.time)).toBe(true);
    expect(result.last_status_text).toBeTruthy();
    if (result.delivery_carrier) expect(result.delivery_tracking_number).toBeTruthy();
  }, 30_000);

  it.skipIf(!process.env.GLOBALPOST_TRACKING_NUMBER)('answers first with providers disabled, then hands a named partner its number', async () => {
    const answer = await createTracker({ providers: [] }).track({ number: process.env.GLOBALPOST_TRACKING_NUMBER!, carrier: 'globalpost' });
    expect(answer).toMatchObject({ carrier: 'globalpost', source: 'globalpost' });
    expect(answer.attempts[0]).toMatchObject({ source: 'globalpost', kind: 'ok' });
    if (answer.result.delivery_carrier) expect(answer.attempts.map((attempt) => attempt.source)).toContain(answer.result.delivery_carrier);
  }, 45_000);

  it.skipIf(!process.env.GLOBALPOST_UNKNOWN_NUMBER)('reads a number without a parcel as not found', async () => {
    await expect(direct().track({ number: process.env.GLOBALPOST_UNKNOWN_NUMBER! })).rejects.toMatchObject({ kind: 'not_found' });
  }, 30_000);
});
