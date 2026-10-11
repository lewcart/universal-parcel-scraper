import type { Stage } from '../../core/status/index.js';
import type { CarrierStatusMap } from '../../core/status/statusMap.js';

/**
 * Helthjem files a parcel and each of its scans under one of twelve states,
 * the `EventStatusType` of its tracking service, and words them in Norwegian.
 * The labels are the tracking page's own.
 */
const STATES: ReadonlyMap<string, { readonly stage: Stage; readonly label: string }> = new Map([
  // The shop announced the parcel; Helthjem does not have it yet.
  ['REGISTERED', { stage: 'registered', label: 'Pakken er registrert' }],
  ['IN_TRANSIT', { stage: 'in_transit', label: 'På vei til mottaker' }],
  // Booked on the coming night's round, which the scan announces.
  ['DELIVERING', { stage: 'out_for_delivery', label: 'Leveres' }],
  ['DELIVERED', { stage: 'delivered', label: 'Levert' }],
  // A home delivery sent on to a pickup point instead.
  ['CONVERTED_TO_STORE', { stage: 'in_transit', label: 'På vei til hentested' }],
  ['DELIVERING_TO_STORE', { stage: 'in_transit', label: 'Leveres til hentested' }],
  ['READY_FOR_PICKUP', { stage: 'ready_for_pickup', label: 'Klar til henting' }],
  // Collected by the recipient at the pickup point.
  ['PICKED_UP', { stage: 'delivered', label: 'Pakken er hentet' }],
  // Not collected in time: it goes back to the shop.
  ['RETURN_TO_STORE', { stage: 'exception', label: 'Pakke ikke hentet' }],
  ['RETURNING', { stage: 'exception', label: 'Returneres' }],
  // The page words it like RETURNING; the state names the parcel as returned.
  ['PARCEL_RETURNED', { stage: 'returned', label: 'Returneres' }],
  ['CANCELED', { stage: 'exception', label: 'Pakken er kansellert' }],
]);

/** The state is a word of capitals and underscores. */
export const STATE = /^[A-Z][A-Z_]{1,39}$/;

export function helthjemStage(state: string): Stage | undefined {
  return STATES.get(state)?.stage;
}

/** The tracking page's label for a state, used when a reply has no scan to word it. */
export function helthjemLabel(state: string): string | undefined {
  return STATES.get(state)?.label;
}

/**
 * A scan's provider code is its state, a slash and its three-digit event
 * code: "IN_TRANSIT/003". A scan without a state keeps its event code alone.
 */
export function helthjemCode(state: string, event: string): string {
  return state && event ? `${state}/${event}` : state || event;
}

/** The map reads the state; a code without one is staged by its wording. */
export const statusMap: CarrierStatusMap = {
  codeKey: (code) => code.split('/')[0] ?? code,
  stage: (code) => {
    const state = code?.split('/')[0];
    return state && STATE.test(state) ? helthjemStage(state) : undefined;
  },
  gaps: [],
};
