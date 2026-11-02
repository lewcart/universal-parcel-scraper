import { describe, expect, it } from 'vitest';
import { NOOP_RECORDER } from '../../core/telemetry/index.js';
import { createTracker } from '../../facade/index.js';
import { adapter } from './adapter.js';

const direct = () => adapter({ recorder: NOOP_RECORDER, env: {}, trawl: null, browserExecutablePath: null });

describe('DEX Pakistan live retrieval', () => {
  it.skipIf(!process.env.DEX_PK_TRACKING_NUMBER)('reads the requested history with providers disabled', async () => {
    const answer = await createTracker({ providers: [] }).track({ number: process.env.DEX_PK_TRACKING_NUMBER! });
    expect(answer).toMatchObject({ carrier: 'dex-pk', source: 'dex-pk' });
    expect(answer.attempts[0]).toMatchObject({ source: 'dex-pk', kind: 'ok' });
    expect(answer.result.events.length).toBeGreaterThan(1);
    expect(answer.result.events.every((event) => typeof event.time === 'string')).toBe(true);
    expect(answer.result.summary_only).not.toBe(true);
    expect(answer.result.destination_country).toBe('PK');
  }, 45_000);

  it.skipIf(!process.env.DEX_PK_ARCHIVED_TRACKING_NUMBER)('reads an explicitly selected older history', async () => {
    const answer = await createTracker({ providers: [] }).track({ number: process.env.DEX_PK_ARCHIVED_TRACKING_NUMBER!, carrier: 'dex-pk' });
    expect(answer).toMatchObject({ carrier: 'dex-pk', source: 'dex-pk' });
    expect(answer.result.events.length).toBeGreaterThan(1);
    expect(answer.result.events.every((event) => typeof event.time === 'string')).toBe(true);
  }, 45_000);

  it.skipIf(!process.env.DEX_PK_TRACKING_NUMBER)('recognizes dated activity without recipient inputs', async () => {
    const answer = await direct().recognize!(process.env.DEX_PK_TRACKING_NUMBER!);
    expect(answer.known).toBe(true);
    expect(answer.lastActivityAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  }, 45_000);

  it.skipIf(!process.env.DEX_PK_UNKNOWN_NUMBER)('does not recognize a synthetic unknown number', async () => {
    await expect(direct().track({ number: process.env.DEX_PK_UNKNOWN_NUMBER! })).rejects.toMatchObject({ kind: 'not_found' });
    await expect(direct().recognize!(process.env.DEX_PK_UNKNOWN_NUMBER!)).resolves.toEqual({ known: false });
  }, 45_000);
});
