import { describe, expect, it } from 'vitest';
import { GLSItalyTracker } from './adapter.js';

describe('GLS Italy live direct retrieval', () => {
  it.skipIf(!process.env.GLS_IT_TRACKING_NUMBER)('retrieves the shipment history', async () => {
    const result = await new GLSItalyTracker().fetch(process.env.GLS_IT_TRACKING_NUMBER!);
    expect(result.events!.length).toBeGreaterThan(0);
    expect(result.events!.every(event => event.local_time && !event.time)).toBe(true);
    expect(result.last_status_text).toBeTruthy();
  });
  it.skipIf(!process.env.GLS_IT_UNKNOWN_NUMBER)('identifies the not-found answer', async () => {
    await expect(new GLSItalyTracker().fetch(process.env.GLS_IT_UNKNOWN_NUMBER!)).rejects.toMatchObject({ kind: 'not_found' });
  });
});
