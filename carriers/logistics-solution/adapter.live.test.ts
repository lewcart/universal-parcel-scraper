import { describe, expect, it } from 'vitest';
import { LogisticsSolutionTracker } from './adapter.js';

describe('logistics-solution live retrieval', () => {
  it.skipIf(!process.env.LOGISTICS_SOLUTION_TRACKING_NUMBER)('reads a known parcel\'s events', async () => {
    const result = await new LogisticsSolutionTracker().fetch(process.env.LOGISTICS_SOLUTION_TRACKING_NUMBER!);
    expect(result.events!.length).toBeGreaterThan(0);
    expect(result.events!.every(event => event.description && event.time)).toBe(true);
  }, 30_000);

  it('reads the site\'s answer for an unknown number as not found', async () => {
    await expect(new LogisticsSolutionTracker().fetch(process.env.LOGISTICS_SOLUTION_UNKNOWN_NUMBER ?? 'LSX000000001'))
      .rejects.toHaveProperty('kind', 'not_found');
  }, 30_000);
});
