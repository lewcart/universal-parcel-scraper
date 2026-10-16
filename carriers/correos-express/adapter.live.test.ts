import { describe, expect, it } from 'vitest';
import { CorreosExpressTracker } from './adapter.js';

describe('Correos Express live tracking', () => {
  it.skipIf(!process.env.CORREOS_EXPRESS_TRACKING_NUMBER)('returns matching public history with the localizador\'s seconds and codes', async () => {
    const result = await new CorreosExpressTracker().fetch(process.env.CORREOS_EXPRESS_TRACKING_NUMBER!);
    expect(result.events?.length).toBeGreaterThan(0);
    // Local clocks only: neither source states an offset.
    expect(result.events?.every(event => !event.time)).toBe(true);
    expect(result.events?.some(event => event.provider_code && /T\d{2}:\d{2}:\d{2}$/.test(String(event.local_time)))).toBe(true);
  });
  it.skipIf(!process.env.CORREOS_EXPRESS_UNKNOWN_NUMBER)('identifies a negative both sources agree on', async () => {
    await expect(new CorreosExpressTracker().fetch(process.env.CORREOS_EXPRESS_UNKNOWN_NUMBER!)).rejects.toMatchObject({ kind: 'not_found' });
  });
});
