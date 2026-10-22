import type { ClassifiedStatus } from '../../core/status/index.js';

const WORDINGS: Record<string, ClassifiedStatus> = {
  'Item delivered': { status: 'delivered', stage: 'delivered' },
  'Item delivered in mailbox': { status: 'delivered', stage: 'delivered' },
  'Item available at Pick-up point': { status: 'in_transit', stage: 'ready_for_pickup' },
  // On its way to a locker, then waiting in it, with the brand the parser puts in place of
  // bpost's placeholder.
  "Item on it's way to Parcel Locker": { status: 'in_transit', stage: 'in_transit' },
  "Item on it's way to bbox locker": { status: 'in_transit', stage: 'in_transit' },
  "Item on it's way to parcel locker": { status: 'in_transit', stage: 'in_transit' },
  'Item available at the Parcel Locker': { status: 'in_transit', stage: 'ready_for_pickup' },
  'Item available at the bbox locker': { status: 'in_transit', stage: 'ready_for_pickup' },
  'Item available at the parcel locker': { status: 'in_transit', stage: 'ready_for_pickup' },
  "The postman's delivery round for your item has started": { status: 'out_for_delivery', stage: 'out_for_delivery' },
  // A delivery abroad that did not happen, as bpost words the partner's attempt: CTT's own
  // "delivery not achieved" comes at the same minute, then the item waits at a pick-up point.
  'Out for delivery - delivery not possible': { status: 'exception', stage: 'failed_attempt' },
  'Shipment presented without success. Addressee is informed.': { status: 'exception', stage: 'failed_attempt' },
  'Your shipment has arrived at the postal operator of the country of destination and will be delivered in the coming days': { status: 'in_transit', stage: 'in_transit' },
  'Your item has been sorted': { status: 'in_transit', stage: 'in_transit' },
  'Item is ready for transport': { status: 'in_transit', stage: 'in_transit' },
  'Shipment ready for transport': { status: 'in_transit', stage: 'in_transit' },
  'Departure to country of destination': { status: 'in_transit', stage: 'in_transit' },
  'Arrival at international depot': { status: 'in_transit', stage: 'in_transit' },
  // Mail from abroad waits for customs at the international depot, which clears it
  // without charges before it leaves for the national network.
  'Awaiting presentation to Customs': { status: 'in_transit', stage: 'customs' },
  'No extra costs': { status: 'in_transit', stage: 'in_transit' },
  'Departure to distribution network': { status: 'in_transit', stage: 'in_transit' },
  'Parcel is handled': { status: 'in_transit', stage: 'in_transit' },
  'Arrival at facilities': { status: 'in_transit', stage: 'in_transit' },
  'Item has passed a checkpoint': { status: 'in_transit', stage: 'in_transit' },
  'Landmark Global (bpost) has received the item': { status: 'in_transit', stage: 'accepted' },
  'Confirmation of preparation of the shipment received': { status: 'pending', stage: 'registered' },
  'Item is announced / Landmark Global (bpost) received the information': { status: 'pending', stage: 'registered' },
};

export function classifyBpostStatus(description: string): ClassifiedStatus | undefined {
  return Object.hasOwn(WORDINGS, description) ? WORDINGS[description] : undefined;
}
