import { describe, expect, it } from 'vitest';
import type { CarrierResult } from './index.js';
import { fillPartialAnswer, isPartialAnswer } from './partial.js';

// Synthetic numbers, clocks and wording.
const NUMBER = '1Z999AA10123456784';
const summary: CarrierResult = {
  status: 'in_transit', last_status_text: 'Synthetic status', last_update: '2026-01-03T09:00:00Z',
  expected_delivery: '2026-01-05', summary_only: true, events: [],
};
const history = {
  status: 'in_transit', last_status_text: 'Departed facility', last_update: '2026-01-03T09:00:00Z',
  events: [
    { time: '2026-01-03T09:00:00Z', description: 'Departed facility' },
    { time: '2026-01-02T18:00:00Z', description: 'Arrived at facility' },
    { time: '2026-01-01T12:00:00Z', description: 'Picked up' },
  ],
} satisfies CarrierResult;

describe('partial carrier answers', () => {
  it('are the ones marked status-only or truncated', () => {
    expect(isPartialAnswer(summary)).toBe(true);
    expect(isPartialAnswer({ ...history, history_truncated: true })).toBe(true);
    expect(isPartialAnswer(history)).toBe(false);
  });

  it('take a fuller history as it came, with the carrier facts it lacks', () => {
    const filled = fillPartialAnswer('ups', NUMBER, summary, { ...history, tracking_provider: 'Ship24' });
    expect(filled).toMatchObject({ tracking_provider: 'Ship24', expected_delivery: '2026-01-05', last_status_text: 'Departed facility' });
    // The provider's events are not resolved: hosts classify them as they persist them.
    expect(filled?.events).toEqual(history.events);
  });

  it('stand against a history that is no fuller, names another carrier or is behind the carrier', () => {
    expect(fillPartialAnswer('ups', NUMBER, { ...history, history_truncated: true }, history)).toBeNull();
    expect(fillPartialAnswer('ups', NUMBER, summary, { ...history, discovered_carrier: 'fedex' })).toBeNull();
    expect(fillPartialAnswer('ups', NUMBER, { ...summary, last_update: '2026-01-04T09:00:00Z' }, history)).toBeNull();
  });

  it('keep the carrier\'s delivery over a history that has not reached it', () => {
    const delivered = { ...summary, status: 'delivered', last_status_text: 'Delivered', last_update: '2026-01-02T08:00:00Z' } as const;
    expect(fillPartialAnswer('ups', NUMBER, delivered, history)).toBeNull();
    const after = { ...history, events: [{ time: '2026-01-03T09:00:00Z', description: 'Processing' },
      { time: '2026-01-02T08:00:00Z', description: 'Delivered' }, ...history.events.slice(2)] };
    expect(fillPartialAnswer('ups', NUMBER, delivered, after)).toMatchObject({ status: 'delivered', current_stage: 'delivered',
      last_status_text: 'Delivered' });
    expect(fillPartialAnswer('ups', NUMBER, delivered, after)).not.toHaveProperty('expected_delivery');
  });
});
