/**
 * What the universal providers share once a payload has been read: the
 * tracking-number guard, the text and notice filters, the event builders with
 * their timezone policy, and the result projection that sorts, deduplicates
 * and summarizes a history.
 *
 * The wording -> stage logic below is provider vocabulary (Ship24, ParcelsApp,
 * 17TRACK and Postal Ninja all render the same aggregated scans), not a
 * carrier status map. Its decisions retain their wording-rule provenance.
 */
import { DateTime } from 'luxon';
import { trackingLanguageStage } from '../../core/status/index.js';
import { deliveryForecastRemainder, nonterminalEnglishReturn } from '../../core/status/language.js';
import type { Stage } from '../../generated/catalog.js';
import type { CarrierEvent, CarrierResult, CarrierStatus } from '../../core/result/index.js';
import { IndeterminateError, InvalidInputError } from '../../core/errors/index.js';
import { isPostiAbroadLabel } from '../../carriers/posti/identity.js';

export type UniversalSource = '17TRACK' | 'ParcelsApp' | 'Postal Ninja' | 'Ship24' | 'UPU';
const STAGES: Record<string, Stage> = {
  InfoReceived: 'registered', InTransit: 'in_transit', AvailableForPickup: 'ready_for_pickup',
  OutForDelivery: 'out_for_delivery', DeliveryFailure: 'failed_attempt', Delivered: 'delivered',
};

export function numberOf(raw: string): string {
  const number = raw.toUpperCase().replace(/[\s.-]/g, '');
  if (!/^(?=.*\d)[A-Z0-9]{4,40}$/.test(number)) throw new InvalidInputError('Tracking', 'Invalid tracking number');
  return number;
}

export function text(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, 500) : '';
}

// Universal sites mix carrier events with UI notices and data updates. Notices must not
// manufacture a shipment timestamp or make an electronic announcement look like movement.
export function isNotice(description: string): boolean {
  return /enter .*?(?:postal|post|zip|phone)|select (?:a |the )?(?:carrier|destination country)|no information about your (?:package|parcel|shipment)|tracking (?:is |temporarily )?unavailable|tracking number (?:not found|is incorrect|must (?:only )?(?:contain|consist|be)\b)|check that (?:the |your )?tracking number is correct|no tracking (?:information|data)|delivery preference|captcha|verify (?:you|your)|enable javascript|try again later|by tapping the button|^shipment parameters updated[.!]?$|^a preferred drop-off location was booked\b/i.test(description);
}

// Raw text, so accented and plain spellings are both listed. A carrier receiving the
// parcel ("Recibido por Estafeta") and German "Firma" (a business) are not private.
export function hasPrivateDeliveryDetails(description: string): boolean {
  return /\bpin\s*:|(?:access|security|pickup|collection) code|(?:door|house) (?:no\b|number)|signed (?:for )?by|signature|numero civico|firmato da|signe par|signé par|code (?:de retrait|d['’]acc[eè]s)|num[eé]ro de (?:rue|maison)|abholcode|zugangscode|hausnummer|unterschrieben von|codice (?:di ritiro|di accesso)|c[oó]digo (?:pin|secreto|de (?:recogida|retirada|retiro|acceso|acesso|entrega|seguridad|seguran[cç]a|levantamento|recolha|desbloqueo|desbloqueio|apertura|abertura))|firmad[oa] por|firma del destinatari|assinad[oa] por|assinatura|n[uú]mero (?:de (?:portal|puerta|casa|piso|vivienda|pol[ií]cia)|da (?:porta|casa))|(?:porta|puerta) n\.?\s?[º°]|n\.?\s?[º°] (?:de |da )?porta/i.test(description);
}

// Labels providers put where a place belongs: a feed's system user ("US, SYSTEM, SYSTEM"),
// an order system's data centre, a line-haul agent and GLS Italy's unnamed sorting hub.
const NOT_PLACES = /^(?:(?:[A-Z]{2}, )?system(?:, system)*|(?:uni )?data cent(?:er|re)|linehaul agent|centro di smistamento(?: - hub)?)$/i;
// Poste Italiane delivers "dalla sede operativa di" the depot's town, which providers also translate.
const DEPOT_PREFIX = /^(?:dalla sede operativa di|from the operational headquarters in)\s+/i;

/**
 * The place a provider reports for a scan, without the words before a depot's
 * town, unless it is a label that names no place, holds private delivery
 * details or is Posti's "abroad" label.
 */
export function place(value: unknown): string {
  const location = text(value).slice(0, 200).replace(DEPOT_PREFIX, '');
  return location && !NOT_PLACES.test(location) && !hasPrivateDeliveryDetails(location) && !isPostiAbroadLabel(location)
    ? location : '';
}

function sourceEventStage(description: string, includeBroadMovement = true): Stage | undefined {
  // Public aggregators retain the carrier's French wording even in English.
  const french = description.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
  if (/colis en preparation chez l'expediteur/.test(french)) return 'registered';
  // Mondial Relay's hub scan, after the parcel was handed in at a relay or locker.
  if (/prise en charge de votre colis sur notre site logistique/.test(french)) return 'in_transit';
  // A sender's parcel left at a pick-up point for a courier to collect: an acceptance, not a parcel awaiting its recipient.
  if (/^the (?:parcel|package) has been delivered to the pick-?up point\. a courier will pick it up\b/i.test(description)) return 'accepted';
  // Posti's handling labels survive in aggregator histories. Registration is
  // a repeated physical scan here, and the reason can describe future customs
  // or delivery without making either the event's stage.
  if (/^(?:the )?item (?:accepted from transport(?:[.!]?$|[.!]? this is a transportation marking\b)|has arrived to destination country(?:[.!]?$|[.!]? the item has reached (?:the target country|finland)\b)|is ready for delivery in destination country[.!]?$|in process in office of exchange(?:[.!]?$|[.!]? the item is being processed\b))/i.test(description)
    || /^(?:the )?item has been registered(?:[.!]?$| the item can be registered several times during delivery\b)/i.test(description)) return 'in_transit';
  // A delivery still to come is no movement; only the rest of the text counts.
  const reported = deliveryForecastRemainder(description);
  if (reported !== undefined) return reported ? sourceEventStage(reported, includeBroadMovement) : undefined;
  if (nonterminalEnglishReturn(description)) return 'exception';
  if (/returned to (?:the )?sender/i.test(description)) return 'returned';
  if (/not delivered|could not.*deliver|unable to deliver|delivery failed/i.test(description)) return 'failed_attempt';
  // A notice card left for the recipient ends the attempt, as Canada Post reads it.
  if (/^notice (?:card )?left\b/i.test(description)) return 'failed_attempt';
  // A new attempt announced for the next round is no failure; the shared rules tell them apart.
  if (/delivery attempt/i.test(description) && [undefined, 'failed_attempt'].includes(trackingLanguageStage(description))) return 'failed_attempt';
  // Carrier-reported problems that are neither a missed attempt nor a return.
  // A new delivery date someone asked for moves on, even filed as an exception.
  if (/damaged|broken in transit|lost in transit|(?:package|parcel|shipment) (?:is )?lost|refused(?: by)?|rejected by (?:the )?recipient|(?:incorrect|incomplete|insufficient|unknown|invalid) address|address (?:incorrect|incomplete|insufficient|unknown|invalid)|addressee (?:unknown|cannot be located)|delivery exception|shipment exception|carrier exception|action required|awaiting instructions/i.test(description)
    && trackingLanguageStage(description) !== 'in_transit') return 'exception';
  // The shared rules tell a hold the recipient asked for, and a customs problem
  // already resolved, from a problem.
  if (/held (?:by|in|at) customs|customs (?:issue|problem)|(?:shipment|parcel) (?:held|on hold)/i.test(description)
    && [undefined, 'exception'].includes(trackingLanguageStage(description))) return 'exception';
  // A voided label was cancelled before shipping, even where a provider files
  // it as transit (17TRACK's generic code). Exact wording only, so a relabel
  // ("label voided, new label created") is not read as a cancellation.
  if (/^(?:parcel|package|shipment|(?:shipping )?label) (?:(?:has been|was|is) )?void(?:ed)?[.!]?$/i.test(description)) return 'exception';
  // Hand-overs on the way: also MailAmericas' airline delivering the bags in the destination
  // country ("Delivered by Airline") and its last-mile distributor taking the item ("Deliver to distributor").
  if (/deliver(?:ed)? to (?:the )?(?:local carrier|delivery partner|post office|distributor)|delivered by (?:the )?airline/i.test(description)) return 'in_transit';
  if (/will be available for (?:pickup|collection)/i.test(description)) return 'in_transit';
  // Sender pre-advice such as Quickpac's "Shipment recorded by sender (data delivered)".
  if (/being prepared by the sender|recorded by (?:the )?(?:foreign )?sender|\bdata delivered\b|en route to .*awaiting processing/i.test(description)) return 'registered';
  // The bare word also appears in handoffs, forecasts and negations ("delivered
  // to airline", "expected to be delivered", "not yet delivered"); those follow
  // the language rules instead of reading as a delivery.
  if (/\bdelivered\b|delivery completed/i.test(description)
    && [undefined, 'delivered'].includes(trackingLanguageStage(description))) return 'delivered';
  if (/ready for (?:pickup|collection)|available for (?:pickup|collection)/i.test(description)) return 'ready_for_pickup';
  // "The status will be updated once shipment is out for delivery" is not the round itself.
  if (/out for delivery/i.test(description)
    && !/(?:once|when|as soon as) (?:the |your )?(?:shipment|parcel|package|item) is out for delivery/i.test(description)) return 'out_for_delivery';
  // Customs wording outranks a provider's own stage. The shared rules tell a
  // release or a completed clearance from customs still at work.
  if (/customs|clearance/i.test(description)) return trackingLanguageStage(description) === 'in_transit' ? 'in_transit' : 'customs';
  if (/instruction data.*provided.*electronically|instruction data transmitted\b|electronic information|information (?:received|submitted)|label (?:created|printed)|pre.?advice|shipment announced/i.test(description)) return 'registered';
  if (/will be transported to the destination country/i.test(description)) return 'in_transit';
  if (!includeBroadMovement) return undefined;
  const providerStage = providerWordingStage(description);
  if (providerStage) return providerStage;
  // A recipient collecting the parcel and a hand-over to an airline are no acceptance.
  if (/package received at dhl ecommerce|^pick-up was successful[.!]?$|accepted|(?<!\byou(?: have|'ve|’ve)? )collected|picked up|handed over(?! to (?:the |an )?(?:airline|air carrier))/i.test(description)) return 'accepted';
  if (/transit|arrived|departed|processed|processing completed at origin|sorting|sorted|transport|dispatched|en route|loaded to movement/i.test(description)) return 'in_transit';
  return undefined;
}

/**
 * Whole scans the aggregators relay in their own or a carrier's words, which
 * no shared rule reads: warehouse and terminal steps, order notices and
 * Chinese postal scans. Each is matched whole, so it says nothing about
 * other wording.
 */
function providerWordingStage(description: string): Stage | undefined {
  // Ship24 relays some feeds' scans with the feed's category or original wording
  // after the sentence: "Order confirmed., OTHER", "Warehouse receipt., 仓库收货".
  const value = description.trim().normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(/\.,\s*(?:other|\p{Script=Han}[\p{Script=Han}\s]*)$/iu, '.');
  // BRT's English status for a parcel on its delivery round reads "FOR DELIVERY" alone.
  if (/^for delivery[.!]?$|^delivery in progress, (?:first|second|third|\d+(?:st|nd|rd|th)) attempt\b|scanned for delivery[;,] ?the courier is\b|^delivery branch\. in the hands of the mailman[.!]?$|^przesyłka wydana do doreczenia kurierowi \w{2,20}[.!]?$|派送员派送途中/i.test(value)) return 'out_for_delivery';
  if (/^order confirmed[.!]?$|^order received(?: successfully)?[.!]?$|^creat(?:e|ed)\. (?:parcel|shipment(?: order)?) created\b|^pre-shipment info sent to\b|^the order has information pending customer confirmation[.!]?$|^waiting for (?:the )?carrier to collect the order[.!]?$|^registered in the system[.!]?$|^your order has been received[.!]?$/i.test(value)) return 'registered';
  // Cainiao's warehouse packing the order, between the order it received and the parcel leaving it.
  if (/^package finished[.!]?$/i.test(value)) return 'registered';
  if (/^export declaration in progress[.!]?$/i.test(value)) return 'customs';
  // MRW's own wording for a parcel left at one of its pickup points, relayed by a provider,
  // and for its pickup from the sender still to come, as MRW's own map reads them.
  if (/^depositado en punto mrw[.!]?$/i.test(value)) return 'ready_for_pickup';
  if (/^pendiente de recoger[.!]?$/i.test(value)) return 'registered';
  // A return on its way back to the sender, as other unfinished returns.
  if (/^the shipment is handled by a return consolidator[.!]?$/i.test(value)) return 'exception';
  // Relay's notices on Vinted parcels, from the label to the parcel in its hands.
  if (/^awaiting your vinted parcel[.!]?$|^expecting your parcel[.!]?$/i.test(value)) return 'registered';
  if (/^parcel received by relay[.!]?$|^received your parcel[.!]?$/i.test(value)) return 'accepted';
  // A parcel at its local warehouse, after the central one; the promise of news that follows is no scan.
  if (/^the (?:package|parcel) is in the local warehouse(?:[.!]?$|\. we will come back with details about (?:the next steps|the delivery)[.!]?$)/i.test(value)) return 'in_transit';
  // Metropolitan Warehouse's furniture steps, as its own map reads them: the order, the vendor
  // pickup booked and done, and its hub, which ParcelsApp writes as Metro-<Warehouse>-Hub.
  if (/^order registered[.!]?$|^pickup scheduled for \d{1,2}\/\d{1,2}\/\d{2,4}[.!]?$/i.test(value)) return 'registered';
  if (/^pickup completed, no exceptions[.!]?$/i.test(value)) return 'accepted';
  if (/^furniture received by metro-(?:[^-]{1,40}-)?hub[.!]?$/i.test(value)) return 'in_transit';
  // SF Express's pickup notice, which goes on to name the courier.
  if (/^sf express has received your package\b/i.test(value)) return 'accepted';
  // iMile's scans as aggregators relay them, its 【】 place names cut or dropped.
  // "Your order has been received" after a centre's name, or after the relay's
  // "Received.", is the receipt at a centre in the destination country, as
  // iMile's own map reads it. A wrong address sends the parcel out again; a
  // recipient who cannot be reached closes the delivery and starts the return.
  if (/^order submit+ed[.!]?$/i.test(value)) return 'registered';
  if (/^we have received the shipment from the sender[.!]?$/i.test(value)) return 'accepted';
  if (/^(?:received\.|(?:\d\) )?[a-z ]{1,40} cent(?:er|re)) your order has been received[.!]?$|^(?:\S+ )?cent(?:er|re) (?:received|parcel shipped to \S+)[.!]?$|^origin port warehouse receive\b|^the flight has taken off[.!]?$|^(?:\S+ )?dispatch task assigned to da[.!]?$/i.test(value)) return 'in_transit';
  if (/^<bad address>$/i.test(value)) return 'failed_attempt';
  // Speedaf's issue scan ending a delivery round the recipient had moved to another day, as its own map reads it.
  if (/^cause of problem\s*【?\s*rescheduled delivery\s*】?[.!]?$/iu.test(value)) return 'failed_attempt';
  if (/^contact error,? need to return[.!]?$|^start returning\b|^\S*devolucion\S* order closed[.!]?$/i.test(value)) return 'exception';
  // A forwarder's arrival at the destination port, worded as a delivery, and its order data sent to the last-mile carrier.
  if (/^delivery has been made at the destination port[.!]?$/i.test(value)) return 'in_transit';
  if (/^order information has been sent to [a-z][a-z .-]{1,30}$/i.test(value)) return 'registered';
  // A shipment manifested, with a courier on the way to collect it from the sender: not in hand yet.
  if (/^manifested(?: - out for pick-?up)?[.!]?$/i.test(value)) return 'registered';
  // GZYL's destination processing centre taking the cleared parcel and sending it on, in GZYL's own spelling.
  if (/^internationall?i?y package received at processing cent(?:er|re)[.!]?$|^leave the e?mail processing cent(?:er|re)[.!]?$/i.test(value)) return 'in_transit';
  // Mayi Yinfu's parcel booked out of its operations centre, and the flight booked for it, as its own map reads them.
  if (/^已出库(?:[,，]货物离开操作中心)?$|^已排航班$/u.test(value)) return 'in_transit';
  // Hermes Germany's hub steps in an aggregator's English, and the aggregator's label for an inbound one.
  if (/^shipment added to loading unit[.!]?$|^received at hub: in motherbag[.!]?$|^shipment received[.!]?$|^the shipment (?:has been|was) prepared for (?:the )?further shipping\b/i.test(value)) return 'in_transit';
  // A bare "parcel handed" is a hand-over to a carrier, which 17TRACK files as a pickup.
  if (/^parcel handed[.!]?$/i.test(value)) return 'accepted';
  if (/^warehouse receipt[.!]?$|^(?:package |parcel )?received by (?:the )?warehouse[.!]?$|^(?:package|parcel) (?:bulk )?received(?: (?:and|&) scanned)? at (?:the )?warehouse[.!]?$|^we['’]ve got it[.!]?$|^received at evri[.!]?$|^acceptance, sent to [a-z ]+$|^china post has received the mail\b|^envio recogido en origen[.!]?$|^first parcel scan along poste italiane['’]s logistic network\b|已收寄|^仓库收货$|^rfid confirmed pick-?up$|^usps in possession of item\b/i.test(value)) return 'accepted';
  if (/^goods leave the operation cent(?:er|re)[.!]?$|^the shipment has left (?:the )?origin country[.!]?$|^(?:delivery\. )?your order has been shipped from (?:\d\) )?[a-z ]{1,40} cent(?:er|re)[.!]?$|^nuevo reparto(?:\. concertacion entrega flexible)?[.!]?$|^new delivery, flexible delivery arrangement[.!]?$|^inventory in a warehouse[.!]?$|^hand over to airline[.!]?$|^in lavorazione[.!]?$|^uscita centro postale[.!]?$|^przesyłka w oddziale \w{2,20}[.!]?$|^(?:package |parcel )?(?:left|leaves?) the warehouse[.!]?$|^we['’]re processing your parcel at our hub\b|^warehouse\. (?:inbound warehouse|delivery in last mile facilities|ready to hand over to last-mile supplier)[.!]?$|^hand over to last mile[.!]?$|^at destination country\/region[.!]?$|^(?:beladung|entladung)$|^entrance to the terminal from the driver$|^outbou?n?d from pickup terminal to the line ?h[ao]u?l$|^inbound from l?ine ?h[ao]u?l to (?:the )?terminal$|^[\w ]+ warehouse, .{1,80}? processing,? (?:order has been (?:in|out)bounded|assembling operation)$|^received in site[- ]|^exported[.!]?$|^(?:the )?plane has landed[.!]?$|^received by (?:the )?airline[.!]?$|^flight delay(?:ed)?[.!](?:$| the flight scheduled\b)|^wi\s*[–-]\s*intermediate warehouse\. (?:container received|package received at intermediate warehouse)[.!]?$|^delivery branch\. received at distribution branch[.!]?$|^receiving destination mail\. received by distributor[.!]?$|^container reception[.!]?$|(?:邮件|快件)(?:到达|离开)处理中心|航空公司接收|已交承运商运输|已完成分拣|^出口海关\/放行|^启运|^干线中转/i.test(value)) return 'in_transit';
  return undefined;
}

export function eventStage(description: string): Stage | undefined {
  const classified = classifyEvent(description);
  return classified.stage_source === 'none' ? undefined : classified.stage;
}

/** Retain the decision before delivery wording is redacted or a stage is projected. */
export function classifyEvent(description: string, declared?: Stage): { stage: Stage; stage_source: string } {
  const specific = sourceEventStage(description, false);
  if (specific) return { stage: specific, stage_source: 'wording:provider' };
  if (declared) return { stage: declared, stage_source: 'carrier_map' };
  const translated = trackingLanguageStage(description);
  if (translated) return { stage: translated, stage_source: 'wording:language' };
  const broad = sourceEventStage(description);
  return { stage: broad ?? 'pending', stage_source: broad ? 'wording:provider' : 'none' };
}

const EXPLICIT_OFFSET = /(?:Z|[+-]\d{2}:\d{2})$/;
const LOCAL_WALL_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/;

function describe(description: unknown, stage?: unknown): { description: string; stage: Stage; stage_source: string } | null {
  const label = text(description);
  if (!label || isNotice(label)) return null;
  const declared = typeof stage === 'string' && Object.hasOwn(STAGES, stage) ? STAGES[stage] : undefined;
  // Established source semantics (e.g. handoff/negation) remain first. A real
  // provider stage outranks the new intuitive translation fallback.
  const classified = classifyEvent(label, declared);
  if (classified.stage !== 'delivered' && hasPrivateDeliveryDetails(label)) return null;
  // Delivery descriptions can include signatures, access codes or door numbers.
  return { description: classified.stage === 'delivered' ? 'Delivered' : label, ...classified };
}

export function event(time: unknown, description: unknown, stage?: unknown): CarrierEvent | null {
  const described = describe(description, stage);
  if (!described) return null;
  // Require an explicit offset: universal events can originate in any timezone.
  if (typeof time !== 'string' || !EXPLICIT_OFFSET.test(time)) {
    throw new TypeError('Tracking event has no valid timezone');
  }
  const date = DateTime.fromISO(time, { setZone: true });
  if (!date.isValid) throw new TypeError('Tracking event has an invalid timestamp');
  return { time: date.toUTC().toISO(), ...described };
}

/**
 * Like event(), but a scan without an offset keeps its wall time as local_time
 * instead of failing the whole shipment. Never invents a UTC instant.
 */
export function localEvent(time: unknown, description: unknown, stage?: unknown): CarrierEvent | null {
  if (typeof time === 'string' && EXPLICIT_OFFSET.test(time)) return event(time, description, stage);
  const described = describe(description, stage);
  if (!described) return null;
  if (typeof time !== 'string' || !LOCAL_WALL_TIME.test(time) || !DateTime.fromISO(time, { zone: 'UTC' }).isValid) {
    throw new TypeError('Tracking event has an invalid timestamp');
  }
  return { local_time: time, ...described };
}

function moment(value: CarrierEvent): string {
  return value.time ?? (typeof value.local_time === 'string' ? value.local_time : '');
}

export function result(events: CarrierEvent[], source: UniversalSource, preserveOrder = false): CarrierResult {
  // Wall times sort alongside UTC instants only approximately; providers that
  // omit offsets everywhere pass preserveOrder instead.
  const scans = new Map<string, CarrierEvent>();
  for (const event of events) {
    const key = `${moment(event)}|${event.description}`;
    const earlier = scans.get(key);
    // A carrier's copy can lack the place another copy of the same scan reported.
    scans.set(key, !event.location && earlier?.location ? { ...event, location: earlier.location } : event);
  }
  const unique = [...scans.values()]
    .sort((a, b) => preserveOrder ? 0 : moment(b).localeCompare(moment(a))).slice(0, 100);
  // A well-formed reply with no scan left after notices and private details proves nothing about the parcel.
  if (!unique.length) throw new IndeterminateError(source, 'No usable tracking events');
  const currentEvent = unique.find((e) => e.stage && e.stage !== 'pending');
  const current = currentEvent?.stage as Stage | undefined;
  // Unknown wording can be displayed, but must not imply movement.
  const status: CarrierStatus = current === 'delivered' ? 'delivered'
    : current === 'registered' || !current ? 'pending'
      : current === 'out_for_delivery' || current === 'ready_for_pickup' ? 'out_for_delivery'
        : ['returned', 'failed_attempt', 'exception'].includes(current) ? 'exception' : 'in_transit';
  return {
    status, current_stage: current ?? 'pending', current_stage_source: currentEvent?.stage_source ?? 'none',
    last_status_text: unique[0]!.description,
    last_update: unique[0]!.time ?? null, expected_delivery: null, timezone: 'UTC',
    tracking_provider: source, events: unique,
  };
}
