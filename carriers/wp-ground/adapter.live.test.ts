import { describe, expect, it } from 'vitest';
import { WpGroundTracker } from './adapter.js';

describe('wp-ground live retrieval', () => {
  it.skipIf(!process.env.WP_GROUND_TRACKING_NUMBER)('reads a known parcel\'s scans', async () => {
    const result = await new WpGroundTracker().fetch(process.env.WP_GROUND_TRACKING_NUMBER!);
    expect(result.events!.length).toBeGreaterThan(0);
    expect(result.events!.every(event => event.description && event.local_time)).toBe(true);
  }, 30_000);

  it.skipIf(!process.env.WP_GROUND_UNKNOWN_NUMBER)('reads the tracker\'s "No Data" as not found', async () => {
    await expect(new WpGroundTracker().fetch(process.env.WP_GROUND_UNKNOWN_NUMBER!)).rejects.toHaveProperty('kind', 'not_found');
  }, 30_000);
});
