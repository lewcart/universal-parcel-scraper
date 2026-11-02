import { describe, expect, it } from 'vitest';
import { NOOP_RECORDER } from '../../core/telemetry/index.js';
import { createTracker } from '../../facade/index.js';
import { adapter } from './adapter.js';

const direct = () => adapter({ recorder: NOOP_RECORDER, env: {}, trawl: null, browserExecutablePath: null });

describe('ROZETKA Delivery live retrieval', () => {
  it.skipIf(!process.env.ROZETKA_DELIVERY_TRACKING_NUMBER)('retrieves native identity-bound history with providers disabled', async () => {
    const answer = await createTracker({ providers: [] }).track({ number: process.env.ROZETKA_DELIVERY_TRACKING_NUMBER!, carrier: 'rozetka-delivery' });
    expect(answer).toMatchObject({ carrier: 'rozetka-delivery', source: 'rozetka-delivery' });
    expect(answer.attempts[0]).toMatchObject({ source: 'rozetka-delivery', kind: 'ok' });
    expect(answer.result.events.length).toBeGreaterThan(0);
    expect(answer.result.events.every(event => event.description && event.provider_code && (event.time || event.local_time))).toBe(true);
    expect(answer.result.summary_only).not.toBe(true);
  });

  it.skipIf(!process.env.ROZETKA_DELIVERY_TRACKING_NUMBER)('recognizes the requested waybill using HTTP only', async () => {
    await expect(direct().recognize!(process.env.ROZETKA_DELIVERY_TRACKING_NUMBER!)).resolves.toMatchObject({ known: true });
  });

  it.skipIf(!process.env.ROZETKA_DELIVERY_UNKNOWN_NUMBER)('reads the explicit unknown response', async () => {
    await expect(direct().track({ number: process.env.ROZETKA_DELIVERY_UNKNOWN_NUMBER! })).rejects.toMatchObject({ kind: 'not_found' });
    await expect(direct().recognize!(process.env.ROZETKA_DELIVERY_UNKNOWN_NUMBER!)).resolves.toEqual({ known: false });
  });
});
