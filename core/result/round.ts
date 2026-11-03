/** The delivery a USPS round promises, as feeds that relay USPS's scans word it. */

// "Out for Delivery, Expected Delivery by 7:40pm", or Between two clocks.
const ROUND = /\bOut for Delivery, Expected Delivery (?:by (\d{1,2}:\d{2} ?[ap]m)|Between (\d{1,2}:\d{2} ?[ap]m) and (\d{1,2}:\d{2} ?[ap]m))$/i;

/** A 12-hour clock as "HH:MM", or null. */
function clock24(text: string): string | null {
  const match = /^(\d{1,2}):(\d{2}) ?([ap]m)$/i.exec(text);
  const hour = Number(match?.[1]);
  if (!match || hour < 1 || hour > 12 || Number(match[2]) > 59) return null;
  return `${String((hour % 12) + (match[3]!.toLowerCase() === 'pm' ? 12 : 0)).padStart(2, '0')}:${match[2]}`;
}

/**
 * The delivery a relayed round promises on `day`, its scan's day on the destination's clock: the
 * day for "by" a time, as USPS's own estimate is read, and the slot for "Between" two clocks.
 */
export function uspsRoundDelivery(description: string, day: string): string | null {
  const match = ROUND.exec(description);
  if (!match || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  if (match[1]) return clock24(match[1]) ? day : null;
  const from = clock24(match[2]!);
  const to = clock24(match[3]!);
  return from && to && from < to ? `${day} ${from}–${to}` : day;
}
