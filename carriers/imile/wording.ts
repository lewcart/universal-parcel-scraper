import { clean } from '../../core/transport/text.js';

// A name iMile opens a scan with, in 【】 and sometimes also in <>: "【<BOG>】 Clearance start.".
const OPENING_NAME = /^【\s*<?([^】<>]*?)>?\s*】\s*/;
// The other names in 【】, and the reasons and dates in <>, which the page shows as typed.
const BRACKETED = /【\s*<?([^】<>]*?)>?\s*】|<([^<>]{1,120})>/g;

/**
 * A scan's wording without iMile's brackets. A name opening the scan is its
 * centre, which its location already shows, or else heads the sentence
 * ("BOG: Clearance start."); the other names, reasons and dates keep their
 * words. Reading it again changes nothing.
 */
export function imileDisplayWording(wording: string, location: string): string {
  const opening = OPENING_NAME.exec(wording);
  const name = opening?.[1]!.trim() ?? '';
  const rest = clean((opening ? wording.slice(opening[0].length) : wording)
    .replace(BRACKETED, (_, inner = '', reason = '') => ` ${String(inner || reason).trim()} `)
    .replace(/\s+([,，;；.。])/g, '$1'));
  if (!name || name.toLowerCase() === location.trim().toLowerCase()) return rest || name;
  return rest ? `${name}: ${rest}` : name;
}
