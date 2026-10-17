import { languageStageStatus, wordingStage, type ClassifiedStatus } from '../../core/status/index.js';

// The official client's milestone groups distinguish delivery, transfer and
// completed return. Failed attempts are observed individual scan states.
const STATES = new Map<number, ClassifiedStatus>([
  [190, { status: 'pending', stage: 'registered' }],
  [1870, { status: 'pending', stage: 'registered' }],
  ...[199, 1910, 4010, 195, 255, 218, 219, 200].map(code => [code, { status: 'in_transit', stage: 'in_transit' }] as [number, ClassifiedStatus]),
  [202, { status: 'out_for_delivery', stage: 'out_for_delivery' }],
  [211, { status: 'exception', stage: 'failed_attempt' }],
  ...[203, 216, 228].map(code => [code, { status: 'delivered', stage: 'delivered' }] as [number, ClassifiedStatus]),
  ...[204, 217].map(code => [code, { status: 'in_transit', stage: 'in_transit' }] as [number, ClassifiedStatus]),
  ...[206, 207, 209, 215, 222, 229, 235].map(code => [code, { status: 'exception', stage: 'exception' }] as [number, ClassifiedStatus]),
  [230, { status: 'exception', stage: 'returned' }],
]);

export function uniuniStatus(code: number): ClassifiedStatus | undefined {
  return STATES.get(code);
}

/**
 * A scan without UniUni's English summary is read by its own code, except 202:
 * cross-border shippers' scans carry it on every row until delivery, so there
 * only the wording tells a received label from a parcel out for delivery.
 */
export function uniuniPartnerStatus(code: number, text: string): ClassifiedStatus | undefined {
  if (code !== 202) return uniuniStatus(code);
  const stage = wordingStage(text);
  return { status: languageStageStatus(stage), stage };
}

/** A Uni Store drop-off carries no status code, only this wording. */
export function uniuniDropOffStage(text: string): ClassifiedStatus | undefined {
  return /^Parcel dropped off at Uni Store\.?$/i.test(text) ? { status: 'in_transit', stage: 'accepted' } : undefined;
}
