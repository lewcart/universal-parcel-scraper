import { describe, expect, it } from 'vitest';
import { MagyarPostaTracker } from './adapter.js';
import { TrawlClient } from '../../core/transport/index.js';

const trawl = TrawlClient.fromEnvironment();
const number = process.env.MAGYAR_POSTA_TRACKING_NUMBER;
const unknown = process.env.MAGYAR_POSTA_UNKNOWN_NUMBER;

describe('Magyar Posta live public tracking', () => {
  it.skipIf(!trawl || !number)('returns the item\'s Hungarian history with wall clocks through the browser service', async () => {
    const result = await new MagyarPostaTracker({ trawl }).fetch(number!, { budgetMs: 60_000 });
    expect(result.last_status_text).toEqual(expect.any(String));
    expect(result.last_update).toBeNull();
    expect(result.events?.length).toBeGreaterThan(0);
    expect(result.events?.every((event) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00$/.test(String(event.local_time)) && !event.time)).toBe(true);
    expect(result.events?.every((event) => /^[1-5]$/.test(String(event.provider_code)))).toBe(true);
  }, 70_000);

  it.skipIf(!trawl || !unknown)('reports a number the tracker does not know as not found', async () => {
    await expect(new MagyarPostaTracker({ trawl }).fetch(unknown!, { budgetMs: 60_000 })).rejects.toMatchObject({ kind: 'not_found' });
  }, 70_000);
});
