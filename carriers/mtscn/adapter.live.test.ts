import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';
import { NOOP_RECORDER } from '../../core/telemetry/index.js';
import { createTracker } from '../../facade/index.js';
import { adapter } from './adapter.js';

const direct = () => adapter({ recorder: NOOP_RECORDER, env: {}, trawl: null, browserExecutablePath: null });

describe('Meiteshun Logistics live retrieval', () => {
  it.skipIf(!process.env.MTSCN_TRACKING_NUMBER)('retrieves the history of the requested parcel with providers disabled', async () => {
    const answer = await createTracker({ providers: [] }).track({ number: process.env.MTSCN_TRACKING_NUMBER!, carrier: 'mtscn' });
    expect(answer).toMatchObject({ carrier: 'mtscn', source: 'mtscn' });
    expect(answer.attempts[0]).toMatchObject({ source: 'mtscn', kind: 'ok' });
    expect(answer.result.events.length).toBeGreaterThan(0);
    // Wall clocks only, and none still ahead on the tracker's own clock.
    const now = DateTime.now().setZone('Asia/Shanghai').toFormat("yyyy-MM-dd'T'HH:mm:ss");
    expect(answer.result.events.every((event) => event.description && !event.time && event.local_time! <= now)).toBe(true);
    expect(answer.result.events.every((event) => event.stage)).toBe(true);
  });

  it.skipIf(!process.env.MTSCN_TRACKING_NUMBER)('recognizes the requested parcel', async () => {
    await expect(direct().recognize!(process.env.MTSCN_TRACKING_NUMBER!)).resolves.toMatchObject({ known: true });
  });

  it.skipIf(!process.env.MTSCN_UNKNOWN_NUMBER)('reads an unknown number as not found', async () => {
    await expect(direct().track({ number: process.env.MTSCN_UNKNOWN_NUMBER! })).rejects.toMatchObject({ kind: 'not_found' });
  });
});
