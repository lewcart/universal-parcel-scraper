import { describe, expect, it } from 'vitest';
import { NOOP_RECORDER } from '../../core/telemetry/index.js';
import { createTracker } from '../../facade/index.js';
import { adapter } from './adapter.js';

const NUMBER = process.env.DPD_PT_TRACKING_NUMBER;
const UNKNOWN = process.env.DPD_PT_UNKNOWN_NUMBER;
const direct = () => adapter({ recorder: NOOP_RECORDER, env: {}, trawl: null, browserExecutablePath: null });
const WALL_CLOCK = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00$/;
const SKIP = 'Node lacks the intermediate certificate DPD Portugal’s tracker does not send';

/** Whether an error is Node refusing the tracker's certificate, which comes without its intermediate. */
function incompleteChain(error: unknown): boolean {
  for (let current = error, depth = 0; current instanceof Error && depth < 8; current = current.cause, depth += 1) {
    if ((current as { code?: unknown }).code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') return true;
  }
  return false;
}

// NODE_EXTRA_CA_CERTS with the tracker's intermediate lets Node read the page.
describe('DPD Portugal live retrieval', () => {
  it.skipIf(!NUMBER)('retrieves the history of the requested parcel with providers disabled', async (context) => {
    try {
      await direct().track({ number: NUMBER! });
    } catch (error) {
      if (incompleteChain(error)) return context.skip(SKIP);
    }
    const answer = await createTracker({ providers: [] }).track({ number: NUMBER!, carrier: 'dpd-pt' });
    expect(answer).toMatchObject({ carrier: 'dpd-pt', source: 'dpd-pt' });
    expect(answer.attempts[0]).toMatchObject({ source: 'dpd-pt', kind: 'ok' });
    expect(answer.result.events.length).toBeGreaterThan(0);
    // Every scan keeps the page's wall clock, without an offset, and its code.
    expect(answer.result.events.every(event => event.description && event.provider_code && !event.time
      && WALL_CLOCK.test(String(event.local_time)))).toBe(true);
    await expect(direct().recognize!(NUMBER!)).resolves.toMatchObject({ known: true });
  }, 60_000);

  it.skipIf(!UNKNOWN)('reads an unknown number as not found', async (context) => {
    try {
      await direct().track({ number: UNKNOWN! });
      expect.unreachable('an unknown number must not answer');
    } catch (error) {
      if (incompleteChain(error)) return context.skip(SKIP);
      expect(error).toMatchObject({ kind: 'not_found' });
    }
    await expect(direct().recognize!(UNKNOWN!)).resolves.toEqual({ known: false });
  }, 30_000);
});
