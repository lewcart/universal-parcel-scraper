import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { normalizeStatusWording, statusMapAnswer } from '../../app.js';
import { seventeenTrackEvent } from '../../providers/seventeentrack/events.js';
import { event } from '../../providers/shared/result.js';
import { statusMap as universal } from '../../providers/status.js';
import type { CarrierEvent } from '../result/index.js';
import type { CarrierStatusMap } from '../status/statusMap.js';
import { classifyWording } from '../status/wording.js';
import { STATUS_MAPS } from './statusMaps.js';

const carriers = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../carriers');
const answer = (carrier: string, providerCode: string | null, description: string) => statusMapAnswer({ carrier, providerCode, description });
const mapped = (stage: string) => ({ kind: 'mapped', stage });
const gap = { kind: 'intentional_gap', note: expect.any(String) };
const unknown = { kind: 'unknown' };

describe('status map answers', () => {
  it('normalizes wording as the app keys its observations', () => {
    expect(normalizeStatusWording('  Parcel\thanded   to DPD\n')).toBe('parcel handed to dpd');
    const long = `${'A'.repeat(499)} B C`;
    expect(normalizeStatusWording(long)).toBe(`${'a'.repeat(499)} `);
    // Stored wording can be asked again as it is.
    expect(normalizeStatusWording('parcel handed to dpd')).toBe('parcel handed to dpd');
  });

  it("answers DPD's codes, and the codes and labels it leaves unmapped on purpose", () => {
    expect(answer('dpd', 'DLO', 'Your parcel is out for delivery')).toEqual(mapped('out_for_delivery'));
    expect(answer('dpd', 'HUI', 'Your parcel arrived at our hub')).toEqual(mapped('in_transit'));
    expect(answer('dpd', 'DELIVERED', 'Delivered')).toEqual(mapped('delivered'));
    expect(answer('dpd', 'PARCEL_HANDED', 'Parcel handed to DPD')).toEqual({
      kind: 'intentional_gap',
      note: "DPD's map leaves it unmapped on purpose: it moves the parcel in transit without a milestone of its own.",
    });
    for (const code of ['IN_TRANSIT', 'AT_DELIVERY_CENTER', 'ORI', 'SPL', 'OTHER', 'SPE', 'MSDLO', 'MIDLI', 'MIA', 'MII', 'ENA']) {
      expect(answer('dpd', code, 'Any wording at all'), code).toEqual(gap);
    }
    // A label gap covers that wording without a code, and only then.
    expect(answer('dpd', null, '  Your parcel is ON its way')).toEqual({
      kind: 'intentional_gap', note: "The label of IN_TRANSIT, which DPD's map leaves unmapped on purpose.",
    });
    expect(answer('dpd', 'ZZZ', 'Your parcel is on its way')).toEqual(unknown);
    // A code gap covers no wording that came without the code.
    expect(answer('dpd', null, 'Your parcel arrived at our depot')).toEqual(unknown);
    expect(answer('dpd', null, 'Parcel out for delivery')).toEqual(unknown);
  });

  it("answers DPD Germany's app scans by their wording, and its guest API by DPD's codes", () => {
    expect(answer('dpd-de', null, 'Picked up from Pickup parcelshop by consignee.')).toEqual(mapped('delivered'));
    expect(answer('dpd-de', null, 'delivered by driver to dpd pickup parcelshop/ station.')).toEqual(mapped('ready_for_pickup'));
    expect(answer('dpd-de', null, 'Pickup ordered for: 05.01.2026')).toEqual(mapped('registered'));
    expect(answer('dpd-de', null, 'Parcel handed to DPD')).toEqual(mapped('accepted'));
    expect(answer('dpd-de', 'DLO', 'Your parcel is out for delivery')).toEqual(mapped('out_for_delivery'));
    expect(answer('dpd-de', 'PARCEL_HANDED', 'Parcel handed to DPD')).toEqual(gap);
    expect(answer('dpd-de', 'DEX', "We couldn't deliver your parcel, it will soon be available at a retrieval point")).toEqual(mapped('failed_attempt'));
    expect(answer('dpd-de', 'DEHDY', 'Your parcel has been delivered to the retrieval point')).toEqual(mapped('ready_for_pickup'));
    expect(answer('dpd-de', 'DODEYY', 'We received the proof of delivery')).toEqual(gap);
    // The Swiss page's labels are not read for German lookups.
    expect(answer('dpd-de', null, 'Your parcel is on its way')).toEqual(unknown);
    expect(answer('dpd-de', null, 'Picked up')).toEqual(unknown);
  });

  it('answers the other declared maps by their own keys', () => {
    expect(answer('gofo-fr', '205', 'Livré')).toEqual(mapped('delivered'));
    expect(answer('gofo-it', '205', 'Consegnato')).toEqual(mapped('delivered'));
    expect(answer('gofo-fr', '205', 'Consegnato')).toEqual(unknown);
    expect(answer('gofo-it', '205', 'Livré')).toEqual(unknown);
    expect(answer('gofo-fr', '206', "Échec de la livraison, motif : Le destinataire n'est pas chez lui")).toEqual(mapped('failed_attempt'));
    expect(answer('gofo-it', '206', 'Consegna fallita, tipo:Destinatario assente')).toEqual(mapped('failed_attempt'));
    expect(answer('gofo-fr', '206', 'Alerte')).toEqual(mapped('exception'));
    expect(answer('gofo-nl', '205', 'Bezorgd in de brievenbus')).toEqual(mapped('delivered'));
    expect(answer('gofo-nl', '205', 'Consegnato')).toEqual(unknown);
    expect(answer('gofo-nl', '206', 'Waarschuwing')).toEqual(mapped('exception'));
    expect(answer('omgo', null, 'Completed Unloading at Delivery Location')).toEqual(mapped('in_transit'));
    expect(answer('omgo', null, 'Tendered for Delivery')).toEqual(mapped('in_transit'));
    expect(answer('tnt', 'RES', 'Shipment delivered in good condition')).toEqual(mapped('delivered'));
    expect(answer('tnt', null, 'Livré')).toEqual(mapped('delivered'));
    expect(answer('tnt', 'ZZ', 'Shipment delivered in good condition')).toEqual(unknown);
    expect(answer('postlogistics', 'DLV', 'Livré')).toEqual(mapped('delivered'));
    expect(answer('postlogistics', 'IMG', 'IMAGE')).toEqual(gap);
    expect(answer('postlogistics', null, 'Image')).toEqual(unknown);
    expect(answer('ups', 'OF', 'Out For Delivery Today')).toEqual(mapped('out_for_delivery'));
    expect(answer('ups', 'PC', 'RFID Confirmed Pickup')).toEqual(mapped('accepted'));
    expect(answer('gofo', '414', 'In Transit to Next Facility')).toEqual(mapped('in_transit'));
    expect(answer('gofo', '810', 'In Transit to Next Facility')).toEqual(mapped('in_transit'));
    expect(answer('gofo', '205', 'Delivered, In Mailbox')).toEqual(mapped('delivered'));
    expect(answer('gofo', '205', 'Synthetic scan')).toEqual(unknown);
    expect(answer('aliexpress', 'GTMS_ORDER_INFO_UPDATE', 'Delivery details updated')).toEqual(gap);
    // Without a code, UPS's map reads only the rendered page's banner.
    expect(answer('ups', null, 'Delivered')).toEqual(mapped('delivered'));
    expect(answer('ups', null, 'Arrived at Facility')).toEqual(unknown);
    expect(answer('ups', 'ZZ', 'Delivered')).toEqual(unknown);
    expect(answer('yunexpress', null, 'Arrived at GOFO Regional Destination Facility')).toEqual(mapped('in_transit'));
    expect(answer('yunexpress', null, 'REMINDER EMAIL SENT FAILED')).toEqual(gap);
    expect(answer('dhl-express', 'PL', 'Processed at EXAMPLE CITY - FRANCE')).toEqual(mapped('in_transit'));
    expect(answer('dhl-express', null, 'Synthetic checkpoint')).toEqual(unknown);
    expect(answer('dhl-express', 'IC', 'Synthetic checkpoint')).toEqual(mapped('customs'));
    expect(answer('speedx', '57104', 'Out for Delivery')).toEqual(mapped('out_for_delivery'));
    expect(answer('speedx', '50001', 'Shipping Label Created')).toEqual(mapped('registered'));
    // A code SpeedX's map does not list is staged by its event's category, which the code alone lacks.
    expect(answer('speedx', '57999', 'Synthetic scan')).toEqual(unknown);
    expect(answer('speedx', null, 'Delivered')).toEqual(unknown);
    expect(answer('j-and-t', '94', 'Package will be delivered')).toEqual(mapped('out_for_delivery'));
    expect(answer('j-and-t', '210', 'Pick-Up')).toEqual(mapped('accepted'));
    // Every router scan carries its code, which alone gives the stage.
    expect(answer('j-and-t', null, 'Delivered')).toEqual(unknown);
    expect(answer('j-and-t', '999', 'Delivered')).toEqual(unknown);
    // HuaHan's scan 17TRACK relays without its code, and JS Express's partners' steps after the import release.
    expect(answer('huahan', null, 'Data processed')).toEqual(mapped('in_transit'));
    expect(answer('huahan', 'ZZ', 'Data processed')).toEqual(unknown);
    expect(answer('js-express', null, 'Prepared for last mile handover')).toEqual(mapped('in_transit'));
    expect(answer('js-express', null, 'The cargo tally in the supervised warehouse is in progress.')).toEqual(mapped('in_transit'));
    expect(answer('js-express', null, 'Domestic allocation has begun')).toEqual(mapped('in_transit'));
    expect(answer('js-express', null, 'Under domestic allocation')).toEqual(mapped('in_transit'));
  });

  it("answers La Poste by the group and code it reads, for every carrier its adapter serves", () => {
    const sort = 'Votre envoi est sur son site de distribution. Nous le préparons pour le mettre en livraison.';
    expect(answer('la-poste', 'DISTOU/MD1', sort)).toEqual(mapped('out_for_delivery'));
    expect(answer('delivengo', 'DISTOU/MD1', sort)).toEqual(mapped('out_for_delivery'));
    expect(answer('la-poste', 'AG1', 'Votre colis vous attend')).toEqual(mapped('ready_for_pickup'));
    expect(answer('la-poste', 'DISARR', 'Votre colis est en cours d’acheminement')).toEqual(mapped('in_transit'));
    // Under keys the map does not read, the stage comes from wording and a default.
    expect(answer('la-poste', null, 'Votre colis vous attend dans votre point de retrait')).toEqual(unknown);
    expect(answer('la-poste', 'XYZ/ZZ9', sort)).toEqual(unknown);
  });

  it('keeps Chronopost codes to the wording seen with them, and its notice is a gap', () => {
    expect(answer('chronopost', 'DC', "Colis en cours de préparation chez l'expéditeur")).toEqual(mapped('registered'));
    expect(answer('chronopost', 'DC', 'Colis livré')).toEqual(unknown);
    expect(answer('chronopost', 'TA', 'Colis en cours de livraison')).toEqual(mapped('out_for_delivery'));
    expect(answer('chronopost', 'RB', 'Colis en cours de livraison au point de retrait')).toEqual(mapped('in_transit'));
    expect(answer('chronopost', 'AB', 'Colis mis à disposition au point de retrait')).toEqual(mapped('ready_for_pickup'));
    expect(answer('chronopost', 'TA', 'Colis en cours de livraison par le livreur')).toEqual(mapped('out_for_delivery'));
    expect(answer('chronopost', 'TA', 'Livraison effectuée')).toEqual(unknown);
    expect(answer('chronopost', 'SM', 'Destinataire informé par SMS ou mail')).toEqual(gap);
    expect(answer('chronopost', 'CL', 'Instruction de livraison reçue')).toEqual(gap);
    expect(answer('chronopost', 'SM', 'Autre message')).toEqual(unknown);
  });

  it('reads the last segment of a Swiss Post code, and a revoked scan has no stage', () => {
    expect(answer('swiss-post', 'PARCEL.*.1.2101', 'Ready for pick-up at PickPost / My Post 24 point')).toEqual(mapped('ready_for_pickup'));
    expect(answer('swiss-post', 'LETTER.*.106.859', 'Your shipment will shortly be handed over to the Swiss Post')).toEqual(mapped('registered'));
    expect(answer('swiss-post', 'LETTER.*.93.9112', 'Enquiry initiated')).toEqual(gap);
    expect(answer('swiss-post', 'PARCEL.*.1.4000', 'Delivered — Revocation')).toEqual(unknown);
    expect(answer('swiss-post', 'PARCEL.*.1.9224', 'Order triggered by recipient: forward')).toEqual(gap);
    expect(answer('swiss-post', 'LETTER.*.90.1800', 'Delay')).toEqual(gap);
    expect(answer('swiss-post', 'PARCEL.*.0.501', 'Picked up at the client')).toEqual(mapped('accepted'));
    expect(answer('swiss-post', 'PARCEL.*.1.502', 'Picked up')).toEqual(mapped('accepted'));
    expect(answer('swiss-post', 'PARCEL.*.1.9999', 'Synthetic scan')).toEqual(unknown);
  });

  it("answers Cainiao's action codes, and the wording the queue holds without one", () => {
    expect(answer('aliexpress', 'TD_TRANS_ARRIVE_DCP', 'Awaiting for transit to final delivery office')).toEqual(mapped('in_transit'));
    expect(answer('aliexpress', 'GTMS_SIGNED', 'Delivered')).toEqual(mapped('delivered'));
    expect(answer('aliexpress', 'GWMS_ACCEPT', 'Shipment accepted by the warehouse')).toEqual(mapped('registered'));
    expect(answer('aliexpress', 'GTMS_DEL_FAILURE', 'Delivery attempt failed')).toEqual(mapped('failed_attempt'));
    expect(answer('aliexpress', 'GTMS_STA_SIGN_FAILURE', 'Synthetic failure')).toEqual(mapped('exception'));
    for (const wording of ['Handed over from linehaul office', 'Leaving transit country/region',
      'Awaiting for transit to final delivery office', '[Exampleville] Departed from destination country/region sorting center']) {
      expect(answer('aliexpress', null, wording), wording).toEqual(mapped('in_transit'));
    }
    expect(answer('aliexpress', 'GTMS_DO_DEPART', 'Out for delivery')).toEqual(mapped('out_for_delivery'));
    expect(answer('aliexpress', 'NEW_UNSEEN_CODE', 'Synthetic scan')).toEqual(unknown);
    expect(answer('aliexpress', null, 'Arrived at linehaul office')).toEqual(unknown);
  });

  it("answers DPD France's wording, the only key its trace page has", () => {
    expect(answer('dpd-fr', null, 'Votre colis a été pris en charge dans notre réseau')).toEqual(mapped('accepted'));
    expect(answer('dpd-fr', null, 'Le destinataire est informé par SMS de la prise en charge de son colis dans notre réseau'))
      .toEqual(mapped('accepted'));
    expect(answer('dpd-fr', null, 'Le destinataire est informé par e-mail de la livraison de son colis ce jour'))
      .toEqual(mapped('out_for_delivery'));
    expect(answer('dpd-fr', null, 'Synthetic wording')).toEqual(unknown);
    expect(answer('dpd-fr', 'DLO', 'Votre colis est livré')).toEqual(unknown);
  });

  it("answers Correos by its event code, and its office hold without one", () => {
    expect(answer('correos-spain', 'B030000V', 'En oficina de cambio')).toEqual(mapped('in_transit'));
    expect(answer('correos-spain', 'D050000V', 'Llegada a oficina de cambio')).toEqual(mapped('in_transit'));
    expect(answer('correos-spain', 'G01L020V', 'A disposición del destinatario')).toEqual(mapped('ready_for_pickup'));
    expect(answer('correos-spain', null, 'A disposición del destinatario')).toEqual(mapped('ready_for_pickup'));
    expect(answer('correos-spain', 'A010000V', 'Admitido.')).toEqual(mapped('accepted'));
    expect(answer('correos-spain', 'Z999999Z', 'A disposición del destinatario')).toEqual(unknown);
    expect(answer('correos-spain', null, 'Admitido.')).toEqual(unknown);
  });

  it("answers Thailand Post's scan codes, and leaves its call and COD payment out on purpose", () => {
    expect(answer('thailand-post', '3', 'Posting/Collection [ EXAMPLE Posting Center ]')).toEqual(mapped('accepted'));
    expect(answer('thailand-post', '31', 'Out for delivery [ EXAMPLE Post Office ]')).toEqual(mapped('out_for_delivery'));
    expect(answer('thailand-post', '28', 'Return to the origin post office')).toEqual(mapped('exception'));
    expect(answer('thailand-post', '57', 'Contact recipient')).toEqual(gap);
    expect(answer('thailand-post', '36', 'Successfully transfer money to seller')).toEqual(gap);
    // A final delivery reads its delivery result, and a utility row its status group.
    expect(answer('thailand-post', '35', 'Successful delivery [ EXAMPLE Post Office ]')).toEqual(unknown);
    expect(answer('thailand-post', '34', 'Item held,addressee notified due to Payment of charges')).toEqual(unknown);
    expect(answer('thailand-post', null, 'Contact recipient')).toEqual(unknown);
    expect(answer('thailand-post', 'toString', 'Synthetic scan')).toEqual(unknown);
  });

  it("answers STO's scan types by the wording stored for them, on the way out and back", () => {
    expect(answer('sto', '派件', 'Out for delivery')).toEqual(mapped('out_for_delivery'));
    expect(answer('sto', '发件', 'Departed for Example hub')).toEqual(mapped('in_transit'));
    expect(answer('sto', '签收', 'Delivered')).toEqual(mapped('delivered'));
    expect(answer('sto', '签收', 'Returned to the sender')).toEqual(mapped('returned'));
    expect(answer('sto', '派件', 'Out for delivery back to the sender')).toEqual(mapped('out_for_delivery'));
    expect(answer('sto', '退回件', 'Return to the sender started')).toEqual(mapped('exception'));
    expect(answer('sto', '派件', 'Delivered')).toEqual(unknown);
    expect(answer('sto', '问题件', '问题件')).toEqual(unknown);
    expect(answer('sto', null, 'Delivered')).toEqual(unknown);
  });

  it("answers An Post's trace codes, narrowed by wording, and its delivery attempt by the website's wording", () => {
    expect(answer('an-post', '70', 'Your item is now available for collection')).toEqual(mapped('ready_for_pickup'));
    expect(answer('an-post', '35', 'We have received information about your incoming item from the sender')).toEqual(mapped('registered'));
    expect(answer('an-post', '83', 'Synthetic customs wording')).toEqual(mapped('customs'));
    // The app's broad in-transit and return categories take a narrower stage from wording.
    expect(answer('an-post', '1', 'Synthetic scan')).toEqual(mapped('in_transit'));
    expect(answer('an-post', '1', 'Your item is out for delivery')).toEqual(mapped('out_for_delivery'));
    expect(answer('an-post', '53', 'Synthetic scan')).toEqual(mapped('returned'));
    // Code 52 at a post office waits there for collection; at any other office it stays the app's sorting.
    expect(answer('an-post', '52', 'Your delivery is in SYNTHETIC TOWN, POST OFFICE')).toEqual(mapped('ready_for_pickup'));
    expect(answer('an-post', '52', 'Your delivery is in SYNTHETIC MAIL CENTRE')).toEqual(mapped('in_transit'));
    expect(answer('an-post', '16', 'Your item was delivered')).toEqual(mapped('delivered'));
    expect(answer('an-post', '16', 'We attempted to deliver your item')).toEqual(mapped('failed_attempt'));
    // Codes the map does not know, and wording without a code, stay open for review.
    expect(answer('an-post', '9999', 'Your item has been delivered')).toEqual(unknown);
    expect(answer('an-post', '014', 'Your item has been delivered')).toEqual(unknown);
    expect(answer('an-post', null, 'Your item has been delivered')).toEqual(unknown);
  });

  it("answers China Post by its scan code, and by the state label that replaced a scan's text", () => {
    expect(answer('china-post', '461', '已到达【美国】投递局')).toEqual(mapped('in_transit'));
    expect(answer('china-post', 'EXB', '出口海关/留存待验')).toEqual(mapped('customs'));
    // The code decides: a delivery attempt keeps its stage under the label 运送中.
    expect(answer('china-post', '542', '运送中')).toEqual(mapped('failed_attempt'));
    expect(answer('china-post', '711', '已退回')).toEqual(mapped('returned'));
    // The acceptance dated from the collector record has no code.
    expect(answer('china-post', null, '已揽收')).toEqual(mapped('accepted'));
    expect(answer('china-post', '999', '已签收')).toEqual(mapped('delivered'));
    // An unmapped code with the scan's own text is staged by a label the key does not hold.
    expect(answer('china-post', '999', '【美国】已妥投')).toEqual(unknown);
    expect(answer('china-post', null, 'Delivered')).toEqual(unknown);
  });

  it('answers Old Dominion by its status, which is its provider code', () => {
    expect(answer('old-dominion', 'In Transit', 'Arrived at EXAMPLE CITY, ST (ABC)')).toEqual(mapped('in_transit'));
    expect(answer('old-dominion', 'Returned To Dock', 'Returned To Dock')).toEqual(mapped('in_transit'));
    expect(answer('old-dominion', 'Pickup Confirmed', 'Pickup Confirmed')).toEqual(mapped('registered'));
    expect(answer('old-dominion', 'Agent Handoff', 'Agent Handoff')).toEqual(mapped('out_for_delivery'));
    expect(answer('old-dominion', 'Delivery Confirmed', 'Delivery Confirmed')).toEqual(mapped('delivered'));
    expect(answer('old-dominion', 'Synthetic Status', 'Synthetic Status')).toEqual(unknown);
    // Every scan of the trace service carries its status.
    expect(answer('old-dominion', null, 'Delivered')).toEqual(unknown);
  });

  it("answers PPL by its event code alone, and leaves its cash-on-delivery steps out on purpose", () => {
    expect(answer('ppl', 'Delivered.Parcelshop', 'We have delivered the shipment to the pick-up point')).toEqual(mapped('ready_for_pickup'));
    expect(answer('ppl', 'Delivered', 'Synthetic wording')).toEqual(mapped('delivered'));
    // Several codes share one wording: the code decides.
    expect(answer('ppl', 'PreparingForDelivery', 'The shipment is in transit')).toEqual(mapped('in_transit'));
    expect(answer('ppl', 'BackToSender.Refused', 'Synthetic wording')).toEqual(mapped('returned'));
    expect(answer('ppl', 'Cod.Completed', 'Synthetic wording')).toEqual(gap);
    expect(answer('ppl', 'Synthetic.NewCode', 'We have delivered the shipment to the recipient')).toEqual(unknown);
    expect(answer('ppl', null, 'We have delivered the shipment to the recipient')).toEqual(unknown);
  });

  it.each(['app', '', 'hongkong-post', '__proto__', 'toString', 'Unknown'])('does not know %s', (carrier) => {
    expect(answer(carrier, 'DLO', 'Delivered')).toEqual(unknown);
  });

  it('does not know a scan without wording', () => {
    expect(answer('dpd', 'DLO', '   ')).toEqual(unknown);
  });
});

describe("universal providers' answers", () => {
  const TIME = '2026-01-01T12:00:00Z';

  it('answer by the wording rules the providers apply, as the app files their scans under unknown', () => {
    expect(answer('unknown', null, 'Processed at EXAMPLE CITY - FRANCE')).toEqual(mapped('in_transit'));
    expect(answer('unknown', null, 'Shipment information received')).toEqual(mapped('registered'));
    expect(answer('unknown', null, 'Clearance processing complete at EXAMPLE GATEWAY - USA')).toEqual(mapped('in_transit'));
    expect(answer('unknown', null, "  Colis en préparation chez l'expéditeur ")).toEqual(mapped('registered'));
    expect(answer('unknown', null, 'Delivered')).toEqual(mapped('delivered'));
    // Wording no rule reads, and a delivery still to come, stay open as gaps.
    expect(answer('unknown', null, 'Estado interno 99')).toEqual(unknown);
    expect(answer('unknown', null, 'Will be delivered tomorrow')).toEqual(unknown);
    expect(answer('unknown', null, '   ')).toEqual(unknown);
    // Chronopost's notice to the recipient, relayed as it is, is no scan.
    expect(answer('unknown', null, 'Destinataire informé par SMS ou mail')).toEqual(gap);
    expect(answer('unknown', 'SM', 'Destinataire informé par SMS ou mail')).toEqual(unknown);
  });

  it("answer by the providers' own reading, not the generic classifier's keyword rules", () => {
    // Posti's repeated handling scan, which the providers read before the shared rules.
    expect(classifyWording('The item has been registered').stage).toBe('registered');
    expect(answer('unknown', null, 'The item has been registered')).toEqual(mapped('in_transit'));
    // The providers leave a bare "Returned" unread, so the sync stores it unstaged.
    expect(classifyWording('Returned').source).toBe('wording:returned');
    expect(answer('unknown', null, 'Returned')).toEqual(unknown);
  });

  it('let a 17TRACK sub-status outrank the wording where the sync does', () => {
    expect(answer('unknown', 'Exception_Cancel', 'Estado interno 99')).toEqual(mapped('exception'));
    expect(answer('unknown', 'Exception_Returned', 'Delivered')).toEqual(mapped('returned'));
    expect(answer('unknown', 'InfoReceived', 'Shipping label created')).toEqual(mapped('registered'));
    expect(answer('unknown', 'InTransit_PickedUp', 'Processed at EXAMPLE HUB')).toEqual(mapped('accepted'));
    // Generic transit yields to any reading of the wording, and a delivery code
    // to wording that does not read as delivered.
    expect(answer('unknown', 'InTransit_Other', 'Arrived at customs')).toEqual(mapped('customs'));
    expect(answer('unknown', 'InTransit_Other', 'Estado interno 99')).toEqual(mapped('in_transit'));
    expect(answer('unknown', 'Delivered_Other', 'Not delivered')).toEqual(mapped('failed_attempt'));
    expect(answer('unknown', 'Delivered_Other', 'Estado interno 99')).toEqual(unknown);
    // Nor does the round's code outrank wording that reads as delivered.
    expect(answer('unknown', 'OutForDelivery_Other', 'Delivered')).toEqual(mapped('delivered'));
    expect(answer('unknown', 'OutForDelivery_Other', 'Estado interno 99')).toEqual(mapped('out_for_delivery'));
    // Any other code, such as a UPU event code the provider does not map, leaves it to the wording.
    expect(answer('unknown', 'EMZ', 'Processed at EXAMPLE HUB')).toEqual(mapped('in_transit'));
    expect(answer('unknown', 'NotFound_Other', 'Estado interno 99')).toEqual(unknown);
  });

  it('give every scan the sync would review the stage the sync stored', () => {
    const wordings = ['Processed at EXAMPLE CITY - FRANCE', 'Shipment information received', 'Arrived at customs',
      'Released from import customs', 'Not delivered', 'Delivered', 'The item has been registered', 'Returned',
      'Will be delivered tomorrow', 'Estado interno 99', 'Parcel on hold at recipient’s request', 'Shipping label created'];
    const codes = [undefined, 'InfoReceived', 'InTransit_Other', 'InTransit_PickedUp', 'OutForDelivery_Other', 'Delivered_Other',
      'Exception_Cancel', 'Exception_Returned', 'NotFound_Other'];
    const scans: CarrierEvent[] = [];
    for (const description of wordings) {
      scans.push(event(TIME, description)!);
      // 17TRACK's own stage label, absent or one the providers do not map, decides whether the scan is reviewed.
      for (const code of codes) for (const stage of [null, 'Synthetic']) {
        scans.push(seventeenTrackEvent({ time_utc: TIME, description, stage, sub_status: code }, {})!);
      }
    }
    // The app reviews every scan whose stage did not come from a map.
    const reviewed = scans.filter(({ stage_source }) => stage_source !== 'carrier_map');
    expect(reviewed.filter(({ provider_code: code }) => code).length).toBeGreaterThan(50);
    for (const scan of reviewed) {
      expect(answer('unknown', scan.provider_code ?? null, scan.description!), JSON.stringify(scan))
        .toEqual(scan.stage === 'pending' ? unknown : mapped(scan.stage!));
    }
  });

  it('close the relayed wording the shared rules read, and keep the rest open', () => {
    expect(answer('unknown', null, 'order details received')).toEqual(mapped('registered'));
    expect(answer('unknown', null, 'shipment is out with courier for delivery')).toEqual(mapped('out_for_delivery'));
    expect(answer('unknown', null, 'admitido.. el envío ha tenido admisión en origen.')).toEqual(mapped('accepted'));
    expect(answer('unknown', null, 'i̇ptal edildi')).toEqual(mapped('exception'));
    // MailAmericas' hand-overs on the way to the last mile are no delivery, and its customs release moves the parcel on.
    for (const wording of ['Arrived at destination country. Delivered by Airline', 'Receiving destination mail. Delivered to Distributor',
      'Deliver to distributor', 'Destination customs. Released']) expect(answer('unknown', null, wording), wording).toEqual(mapped('in_transit'));
    // Postal Ninja's, ParcelsApp's and Ship24's relayed steps, read whole.
    for (const [wording, stage] of [['registered in the system', 'registered'], ['2) Example Center Your order has been received', 'in_transit'],
      ['USPS in possession of item, EXAMPLE, ST 00000', 'accepted'], ['inventory in a warehouse', 'in_transit'], ['hand over to airline', 'in_transit'],
      ['new delivery, flexible delivery arrangement', 'in_transit'], ['in lavorazione', 'in_transit'], ['uscita centro postale', 'in_transit'],
      ['Your order has been shipped from 2) Example Center', 'in_transit']] as const) expect(answer('unknown', null, wording), wording).toEqual(mapped(stage));
    for (const wording of ["in paack's distribution centre", 'girildi', 'order triggered by recipient: forward', 'Released']) {
      expect(answer('unknown', null, wording), wording).toEqual(unknown);
    }
  });

  it("read An Post's relayed sentences as its trace codes stage them", () => {
    for (const [code, wording, stage] of [
      [35, 'We have received information about your incoming item from the sender', 'registered'],
      [15, 'Your item has been handed to An Post', 'accepted'],
      [48, 'We have your item and will process it for delivery', 'accepted'],
      [5, 'Your item is being sent internationally. We will aim to show tracking updates as they become available, or visit the local delivery provider website for updates.', 'in_transit'],
      [40, 'Your item arrived abroad. We will aim to show tracking information from the receiving post, but would recommend tracking the item further on their site', 'in_transit'],
      [73, 'Your item is being prepared for delivery', 'in_transit'],
      [70, 'Your item is now available for collection', 'ready_for_pickup'],
      [13, 'Your item was not collected within the specified timeframe. This item will now be returned to sender.', 'failed_attempt'],
    ] as const) {
      expect(answer('unknown', null, wording), wording).toEqual(mapped(stage));
      expect(answer('an-post', String(code), wording), wording).toEqual(mapped(stage));
    }
    // Only the whole sentence is An Post's.
    expect(answer('unknown', null, 'We have received information about your incoming item')).toEqual(unknown);
  });

  it("close the aggregators' whole scans no shared rule reads, and nothing like them", () => {
    for (const [wording, stage] of [
      ['Warehouse receipt.', 'accepted'], ['Received by warehouse', 'accepted'], ['Package received and scanned at warehouse', 'accepted'],
      ["We've got it", 'accepted'], ['Received at Evri', 'accepted'], ['Received by our network', 'accepted'], ['Checked in at origin hub', 'accepted'], ['Parcel received and processing', 'accepted'], ['Acceptance, Sent To Spain', 'accepted'],
      ['China Post has received the mail', 'accepted'], ['Envío recogido en origen', 'accepted'],
      ['First parcel scan along Poste Italiane’s logistic network', 'accepted'], ['RFID Confirmed Pickup', 'accepted'],
      ['示例处理中心已收寄【示例市】', 'accepted'],
      ['parcel handed', 'accepted'],
      ['Instruction data transmitted to DPD', 'registered'], ['Order confirmed.', 'registered'], ['Order received successfully', 'registered'],
      ['Package finished', 'registered'],
      ['Created. Parcel created by Example Shop at EXA', 'registered'], ['create. Shipment order created', 'registered'],
      ['Pre-Shipment Info Sent To Spain', 'registered'],
      ['The order has information pending customer confirmation.', 'registered'],
      // Ship24's copies carry the feed's category or original wording after the sentence.
      ['Order confirmed., OTHER', 'registered'], ['Warehouse receipt., 仓库收货', 'accepted'], ['仓库收货', 'accepted'],
      ['Export declaration in progress., OTHER', 'customs'], ['Flight delayed., OTHER', 'in_transit'],
      ['Flight delay. The flight scheduled for the 7th is expected to be delayed', 'in_transit'],
      ['Airline delay', 'in_transit'], ['Flight delay', 'in_transit'], ['Parcel shipped', 'in_transit'], ['Customer information manifested', 'registered'],
      ['Goods leave the operation center', 'in_transit'], ['Package left the warehouse', 'in_transit'], ['Leave the warehouse', 'in_transit'],
      ["We're processing your parcel at our hub", 'in_transit'], ['Warehouse. Inbound warehouse', 'in_transit'],
      ['Warehouse. Delivery in last mile facilities', 'in_transit'], ['Warehouse. Ready to hand over to last-mile supplier', 'in_transit'],
      ['Hand Over To Last Mile', 'in_transit'], ['At destination country/region', 'in_transit'], ['Beladung', 'in_transit'],
      ['Entladung', 'in_transit'], ['Entrance to the terminal from the driver', 'in_transit'],
      ['Shipment Unloaded in Collection Terminal', 'in_transit'], ['Outboud from pickup terminal to the linehoul', 'in_transit'],
      ['Inbound from inehoul to terminal', 'in_transit'],
      ['Example warehouse, Example warehouse processing, order has been outbounded', 'in_transit'],
      ['Example warehouse, Example warehouse processing assembling operation', 'in_transit'],
      ['Received in Site-Example，the pick-up is Example', 'in_transit'], ['Exported', 'in_transit'], ['Plane has landed', 'in_transit'],
      ['Received by airline', 'in_transit'], ['WI – Intermediate warehouse. Container received', 'in_transit'],
      ['WI – Intermediate warehouse. Package received at Intermediate Warehouse', 'in_transit'],
      ['Delivery branch. Received at Distribution Branch', 'in_transit'], ['Receiving destination mail. Received by Distributor', 'in_transit'],
      ['Container reception', 'in_transit'],
      ['Internationaliy Package received at processing center', 'in_transit'], ['Leave the email processing center', 'in_transit'],
      ['邮件到达处理中心【示例】', 'in_transit'], ['快件离开处理中心【示例】', 'in_transit'], ['航空公司接收【示例】', 'in_transit'],
      ['已交承运商运输【示例】', 'in_transit'], ['邮件已完成分拣，准备发出【示例】', 'in_transit'], ['出口海关/放行【示例】', 'in_transit'],
      ['启运【示例】', 'in_transit'], ['干线中转', 'in_transit'],
      ['已出库,货物离开操作中心', 'in_transit'], ['已出库', 'in_transit'], ['已排航班', 'in_transit'],
      ['Delivery in progress, second attempt', 'out_for_delivery'],
      ['Site-ExampleScanned for delivery;the courier is Example', 'out_for_delivery'],
      ['交接成功-交出（派送员派送途中）', 'out_for_delivery'],
      ['Delivery branch. In the hands of the mailman', 'out_for_delivery'],
      ['FOR DELIVERY', 'out_for_delivery'],
      ['The shipment has left origin country', 'in_transit'], ['Przesyłka w oddziale FedEx.', 'in_transit'],
      ['Przesyłka wydana do doręczenia kurierowi FedEx.', 'out_for_delivery'],
      ['The shipment is handled by a return consolidator', 'exception'],
      ['Delivery. Your order has been shipped from the distribution center', 'in_transit'],
      // iMile's receipt at a centre in the destination country, and its dispatch from there.
      ['Example center Your order has been received', 'in_transit'], ['Received. Your order has been received', 'in_transit'],
      ['Your order has been shipped from Example center', 'in_transit'], ['Your order has been received', 'registered'],
      ['NUEVO REPARTO. Concertación entrega flexible', 'in_transit'], ['NUEVO REPARTO', 'in_transit'],
      ['Waiting for carrier to collect the order', 'registered'], ['Depositado en punto MRW', 'ready_for_pickup'], ['Pendiente de recoger', 'registered'],
      ['Order Submited', 'registered'], ['We have received the shipment from the sender', 'accepted'], ['Center Received', 'in_transit'],
      ['Origin port warehouse receive，Flight Schedule ETD MIA <2026-01-13 07:05:00>, ETA BOG <2026-01-13 09:50:00>', 'in_transit'],
      ['The flight has taken off', 'in_transit'], ['Center Parcel shipped to EXAMPLE.DS', 'in_transit'],
      ['EXAMPLE.DS Dispatch task assigned to DA', 'in_transit'], ['<Bad Address>', 'failed_attempt'],
      ['Cause of problem Rescheduled delivery', 'failed_attempt'], ['Cause of problem【Rescheduled delivery】', 'failed_attempt'],
      ['Contact Error need to return', 'exception'], ['Start returning，reason:[Contact Error]', 'exception'],
      ['EXA-DEVOLUCION.DS Order Closed', 'exception'],
      ['Shipment added to loading unit', 'in_transit'], ['Received at hub: in motherbag', 'in_transit'], ['Shipment received', 'in_transit'],
      ['The shipment has been prepared for further shipping in Example', 'in_transit'],
      ['The shipment was prepared for further shipping in Example (Example)', 'in_transit'],
      ['Notice card left indicating where and when to pick up item', 'failed_attempt'],
      ['Delivery has been made at the destination port', 'in_transit'], ['目的港已提货 Delivery has been made at the destination port', 'in_transit'],
      ['目的港已提货', 'in_transit'], ['The shipment was left at a drop-off location', 'delivered'], ['Order information has been sent to DPD.', 'registered'],
      ['Package received & scanned at warehouse', 'accepted'],
      ['Manifested - Out for Pickup', 'registered'], ['Manifested', 'registered'],
      ['Awaiting your Vinted parcel', 'registered'], ['Expecting Your Parcel', 'registered'],
      ['Parcel received by Relay', 'accepted'], ['Received Your Parcel', 'accepted'], ['Collection Complete', 'delivered'],
      ['Export Scan', 'in_transit'],
      ['Received in warehouse', 'accepted'], ['Item deposited to local postal operator', 'in_transit'],
      ['Item handed over to subcontractor', 'in_transit'], ['Item announced', 'registered'], ['Item sent', 'in_transit'],
      ['Item received in destination country', 'in_transit'],
      ['Item posted / received from customer Customer centre: Example', 'accepted'],
      ['International item mailed in originating country', 'accepted'],
      ['The shipment has been posted by the sender at the retail outlet', 'accepted'], ['Label correction applied', 'in_transit'],
      ['Domestic allocation has begun', 'in_transit'], ['Under domestic allocation', 'in_transit'],
      ['Delivery to local courier', 'in_transit'],
      ['Item received at exchange office', 'in_transit'], ['Your delivery is in EXAMPLE TOWN, POST OFFICE', 'ready_for_pickup'],
      ['Delivery scheduled during the day.', 'out_for_delivery'], ['USPS in possession of the item, EXAMPLE, NY', 'accepted'],
      ['Order registered', 'registered'], ['Pickup scheduled for 01/02/2026', 'registered'],
      ['Pickup completed, No exceptions', 'accepted'], ['Furniture Received by Metro-<Warehouse>-Hub', 'in_transit'],
      ['Furniture Received by Metro-Example-Hub', 'in_transit'],
      ['The package is in the local warehouse. We will come back with details about the next steps', 'in_transit'],
      ['The package is in the local warehouse. We will come back with details about the delivery', 'in_transit'],
      ['The parcel has been delivered to the pick-up point. A courier will pick it up soon and take it to storage', 'accepted'],
      ['The parcel has been delivered to the pick-up point', 'ready_for_pickup'],
      ['SF Express has received your package, we sincerely protect your expectations, and will not let you down. If you have any questions, please contact courier Example at 10000000000.', 'accepted'],
    ] as const) expect(answer('unknown', null, wording), wording).toEqual(mapped(stage));
    // Each is matched whole: the same words in another scan, and the report's open wording, stay unread.
    for (const wording of ['Order received from retailer, awaiting stock', 'Warehouse receipt pending', 'Not received from retailer',
      'Parcel is with the driver', 'Item received', 'Driver assigned', 'Benachrichtigt', 'Delivery branch. Rescheduling', 'Order confirmed., pending',
      'Przesyłka w oddziale', 'Przesyłka w oddziale FedEx czeka na odbiór', 'Your order has been shipped from the distribution center to the store',
      'Concertación entrega flexible', 'Waiting for carrier to collect the order from the warehouse', 'Depositado en punto MRW de origen',
      'Order Closed', 'Center', 'Dispatch task assigned', 'Expecting your parcel back', 'Parcel received by relay point',
      'Ready for delivery', 'Shipment received from retailer', 'Received at hub',
      'Delivery has been made at the destination port of Example', '目的港已提货待清关', 'Received by our network partner in Example', 'Checked in at origin hub of Example', 'Parcel shipped to Example', 'The shipment was left at a drop-off location for the courier', 'Order information has been sent',
      'Received.', 'Received. Your order has been received by the store', 'Package finished at the store',
      'Package received at processing center', '未出库', '已出库待取件', '未排航班', 'Pendiente de recoger en Example', 'Cause of problem',
      'Rescheduled delivery', 'Parcel handed to the recipient', 'Parcel handed over to the recipient', 'Handed over to your neighbour', 'Pickup document attached', 'Pickup completed', 'Pickup scheduled',
      'Order registered by the recipient', 'We will come back with details about the delivery', 'The package is in the local warehouse for collection',
      'Courier collection complete', 'Collection complete from sender',
      'Export scan pending', 'Awaiting export scan', 'Received in warehouse Example', 'Item deposited',
      // A forecast sent to the last-mile carrier, detail lines, a store hand-over that is a drop-off or a
      // collection, and headings with no step of their own.
      'Last-mile delivery forecast', 'Keine weiteren Details erforderlich', 'Filiale / Agentur', 'Parcel to be taken to a Yodel Store',
      'Received at Example Store', 'In progress', 'Update on your parcel', 'Your order has been shipped from Example center to the store']) {
      expect(answer('unknown', null, wording), wording).toEqual(unknown);
    }
  });

  it("leave out only Chronopost's notice to the recipient on purpose", () => {
    expect(universal.gaps.map((gap) => gap.wording)).toEqual(['destinataire informé par sms ou mail']);
  });
});

describe('declared status maps', () => {
  const declared = Object.entries<CarrierStatusMap>(STATUS_MAPS);

  it('registers every carrier that declares one', async () => {
    const found: string[] = [];
    for (const carrier of readdirSync(carriers).sort()) {
      if (!readdirSync(path.join(carriers, carrier)).includes('status.ts')) continue;
      const module = await import(path.join(carriers, carrier, 'status.ts')) as { statusMap?: CarrierStatusMap };
      if (module.statusMap) {
        found.push(carrier);
        expect(STATUS_MAPS[carrier], carrier).toBe(module.statusMap);
      }
    }
    expect(found).toEqual(Object.keys(STATUS_MAPS).sort());
  });

  it.each(declared)('%s keys its gaps as the app does, and stages none of them', (_carrier, map) => {
    const keys = map.gaps.map(({ code, wording }) => JSON.stringify([code ?? null, wording ?? null]));
    expect(new Set(keys).size).toBe(keys.length);
    for (const { code, wording, note } of map.gaps) {
      expect(code !== undefined || wording !== undefined).toBe(true);
      expect(code === undefined || (code.length >= 1 && code.length <= 100)).toBe(true);
      if (wording !== undefined) expect(normalizeStatusWording(wording)).toBe(wording);
      expect(note.length >= 1 && note.length <= 500).toBe(true);
      expect(map.stage(code ?? null, wording ?? 'synthetic wording')).toBeUndefined();
    }
  });
});
