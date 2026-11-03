import { statusWordings } from '../../core/status/english.js';
import { classifyWording, type ClassifiedWording, type Stage } from '../../core/status/index.js';
import { normalizeStatusWording, type CarrierStatusMap } from '../../core/status/statusMap.js';
import statuses from './statuses.json' with { type: 'json' };

const WORDINGS = statusWordings(statuses.entries);

// The rows that name a city or an airport: "… d'origine à Toronto.", "… de l'aéroport international Pearson de Toronto.",
// "… à l'aéroport in DE.".
const PLACES = [
  /^(le colis est arrivé au centre de traitement d'origine à ).+?(\.?)$/,
  /^(l'envoi est arrivé au terminal de fret de l'aéroport ).+?(\.?)$/,
  /^(l'envoi a quitté l'aéroport ).+?( et est en transport international\.?)$/,
  /^(l'envoi est arrivé à l'aéroport ).+?(\.?)$/,
];

/** The key a row's `normalizeStatusWording` wording is mapped under: a city or airport it names becomes an ellipsis. */
export const quickFortScanKey = (wording: string): string => {
  const place = PLACES.find((pattern) => pattern.test(wording));
  return place ? wording.replace(place, '$1…$2') : wording;
};

/** The stage Quick Fort's map gives a row's `normalizeStatusWording` wording. */
const mappedStage = (wording: string): Stage | undefined => WORDINGS.stage(quickFortScanKey(wording));

/**
 * Quick Fort's rows have no codes: its map reads the carrying network's French sentences, then the shared
 * classifier reads any other, without a fallback stage.
 */
export function quickFortStage(wording: string): ClassifiedWording | null {
  if (!wording) return null;
  const mapped = mappedStage(normalizeStatusWording(wording));
  if (mapped) return { stage: mapped, source: 'carrier_map' };
  const staged = classifyWording(wording, 'in_transit');
  return staged.source === 'none' ? null : staged;
}

export const statusMap: CarrierStatusMap = { stage: (_code, wording) => mappedStage(wording), gaps: [] };
