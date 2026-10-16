import { describe, expect, it } from 'vitest';
import { AdapterRegistry, REGISTRY, UniversalTracker, trackCarrier } from '../../node.js';
import { NOOP_RECORDER } from '../../core/telemetry/index.js';
import { fetchPostNL } from './adapter.js';

// A validly shaped Dutch S10 number that was never issued: PostNL answers with
// an item that has no events and says the barcode was not found.
const POSTNL_WRONG_NUMBER = 'LT000000000NL';
// A private parcel, as a consumer stored it (see this folder's README).
const number = (process.env.SPRING_GDS_TRACKING_NUMBER ?? '').trim();

describe('PostNL live tracking', () => {
  it('maps the official barcode-not-found result to a clean 404', async () => {
    await expect(fetchPostNL(POSTNL_WRONG_NUMBER)).rejects.toMatchObject({
      name: 'NotFoundError',
      status: 404,
      message: 'PostNL could not locate the shipment',
    });
  });

  it.runIf(Boolean(number))('returns the history of a parcel dispatched through a consumer router', async () => {
    const environment = { trawl: null, browserExecutablePath: null, env: {}, recorder: NOOP_RECORDER };
    const result = await trackCarrier('spring-gds', { number }, {
      registry: new AdapterRegistry(REGISTRY, environment), universal: new UniversalTracker({ environment, providers: [] }),
    });
    expect(result.events?.length).toBeGreaterThan(0);
  });
});
