import { describe, expect, it } from 'vitest';
import { event, result } from './result.js';

describe('shared provider result', () => {
  it('drops an entry in wording no rule reads when it is dated at the lookup', () => {
    const now = Date.now();
    const at = (ago: number) => new Date(now - ago).toISOString();
    const scan = event(at(86_400_000), 'Arrived at sorting center')!;
    const notice = event(at(1_000), 'Example notice nobody has worded before')!;
    expect(notice.stage_source).toBe('none');
    expect(result([notice, scan], 'ParcelsApp').events?.map(({ description }) => description)).toEqual(['Arrived at sorting center']);
    // A provider's clock can run ahead of ours.
    expect(result([event(new Date(now + 60_000).toISOString(), notice.description)!, scan], 'ParcelsApp').events).toHaveLength(1);
    // Read wording that new is a scan, and unread wording an hour old is a scan in words no rule knows yet.
    expect(result([event(at(1_000), 'Delivered')!, scan], 'ParcelsApp').events).toHaveLength(2);
    expect(result([event(at(3_600_000), notice.description)!, scan], 'ParcelsApp').events).toHaveLength(2);
    // A notice alone says nothing about the parcel.
    expect(() => result([notice], 'ParcelsApp')).toThrow('No usable tracking events');
  });

  it("keeps no time for the seller's step when it is dated after the lookup", () => {
    const now = Date.now();
    const at = (offset: number) => new Date(now + offset).toISOString();
    const ahead = result([event(at(22 * 3_600_000), 'Pending shipping by the seller')!], 'ParcelsApp');
    expect(ahead).toMatchObject({ status: 'pending', current_stage: 'registered', last_update: null });
    expect(ahead.events).toHaveLength(1);
    expect(ahead.events?.[0]).not.toHaveProperty('time');
    // Dated before the lookup, it is the moment of the step.
    expect(result([event(at(-3_600_000), 'Pending shipping by the seller')!], 'ParcelsApp').events?.[0]?.time).toBe(at(-3_600_000));
    // Another scan dated ahead keeps its time, for the parcel app to flag.
    expect(result([event(at(22 * 3_600_000), 'Arrived at sorting center')!], 'ParcelsApp').events?.[0]?.time).toBe(at(22 * 3_600_000));
  });
});
