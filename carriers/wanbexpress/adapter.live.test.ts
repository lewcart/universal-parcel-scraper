import { describe, expect, it } from 'vitest';
import { createTracker } from '../../facade/index.js';

describe('WanbExpress live retrieval', () => {
  it.skipIf(!process.env.WANBEXPRESS_TRACKING_NUMBER || !process.env.FLARESOLVERR_URL)('retrieves the requested parcel after browser verification', async () => {
    const answer = await createTracker({ providers: [] }).track({ number: process.env.WANBEXPRESS_TRACKING_NUMBER!, carrier: 'wanbexpress' }, { budgetMs: 55000 });
    expect(answer).toMatchObject({ carrier: 'wanbexpress', source: 'wanbexpress' });
    expect(answer.result.events.length).toBeGreaterThan(0);
    expect(answer.result.events.every(event => event.description && event.time)).toBe(true);
    expect(answer.result.last_update).toBeTruthy();
  });
});
