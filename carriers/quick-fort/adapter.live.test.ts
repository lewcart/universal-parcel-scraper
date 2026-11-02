import { describe, expect, it } from 'vitest';
import { QuickFortTracker } from './adapter.js';

describe('quick-fort live retrieval', () => {
  it.skipIf(!process.env.QUICK_FORT_TRACKING_NUMBER)('reads a known order\'s rows', async () => {
    const result = await new QuickFortTracker().fetch(process.env.QUICK_FORT_TRACKING_NUMBER!);
    expect(result.events!.length).toBeGreaterThan(0);
    expect(result.events!.every(event => event.description && event.time?.endsWith('+08:00'))).toBe(true);
  }, 30_000);

  it.skipIf(!process.env.QUICK_FORT_UNKNOWN_NUMBER)('reads the site\'s "no order" notice as not found', async () => {
    await expect(new QuickFortTracker().fetch(process.env.QUICK_FORT_UNKNOWN_NUMBER!)).rejects.toHaveProperty('kind', 'not_found');
  }, 30_000);
});
