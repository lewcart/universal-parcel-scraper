/**
 * The universal providers' status map. The parcel app files every scan a
 * universal provider relays under the carrier `unknown`, and no carrier map
 * stands behind those scans: the reading the providers give one is their map.
 * That is a 17TRACK sub-status where it outranks the wording
 * (`seventeentrack/status.ts`), else the wording rules every provider
 * applies (`classifyEvent`: their own vocabulary around the shared language
 * rules). A stage a provider declares and a UPU event code it maps are
 * `carrier_map`, so their scans never reach the app's review. Wording no rule
 * reads has no stage. Only Chronopost's notice to the recipient, which is no
 * scan, is left out on purpose.
 */
import { CHRONOPOST_NOTIFICATION } from '../carriers/chronopost/status.js';
import { normalizeStatusWording, type CarrierStatusMap } from '../core/status/statusMap.js';
import { subStatusStage } from './seventeentrack/status.js';
import { classifyEvent } from './shared/result.js';

export const statusMap: CarrierStatusMap = {
  stage: (code, wording) => {
    const read = classifyEvent(wording);
    return (code ? subStatusStage(code, read.stage) : undefined) ?? (read.stage_source === 'none' ? undefined : read.stage);
  },
  gaps: [{
    wording: normalizeStatusWording(CHRONOPOST_NOTIFICATION),
    note: "Chronopost's notice to the recipient, relayed as it is: not a scan, so it keeps the stage the parcel already had.",
  }],
};
