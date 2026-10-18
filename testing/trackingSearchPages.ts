import type { CarrierId } from '../generated/catalog.js';

/**
 * Carriers that link a parcel but have no public page to type its number in.
 * A parcel whose number is hidden shows no link to them.
 */
export const carriersWithoutSearchPage: Partial<Record<CarrierId, string>> = {
  'amazon-logistics': 'Amazon shows its own deliveries only in the buyer\'s account; no public page takes the number',
  blueex: 'blue-ex.com hides its tracking forms on phone-sized screens; its own links open the tracking page with the number',
  ciblex: 'Ciblex shows parcels only in its customer extranet, behind a sign-in',
  deprisa: 'Deprisa\'s tracker opens a shipment from the number in its address; archived copies of its pages show no number field, and deprisa.com answers 403 to many networks outside Colombia',
  'forza-delivery': 'Forza\'s tracker is a script-rendered app at rastreo.forzadelivery.com; the search-page check finds no number field on it, and a guía opens at its own address',
  'iran-post': 'post.ir and tracking.post.ir refuse many networks outside Iran; its tracker opens a parcel from the number in its address',
  kargoist: 'kargoist.com\'s tracking page asks for a code sent by text message, and its home page, whose form opened a parcel from the number, shows a maintenance notice',
  liccardi: 'www.liccarditrasporti.com answers automated browsers with a bot check; its tracker opens a parcel from the number in its address',
  'nim-express': 'nimexpress.com\'s tracking fields are a script widget and a form that asks for a confirmation code; its own header form opens the tracking page with the number',
  rivigo: 'Rivigo\'s public tracker is a hash route on zoom.rivigo.com whose other pages redirect to the staff sign-in; a consignment opens at its own address',
  'skynet-worldwide': 'SkyNet\'s tracker shows its number field only with a network parameter in the address, and skynetworldwide.com has no tracking page of its own',
  torrestir: 'Torrestir hides its number field on phone-sized screens, in a collapsed menu; its Track & Trace button opens the tracker with the number',
  yimidida: 'www.yimidida.com answers the search-page check with its cloud firewall\'s 405 block page; a waybill opens at its own address',
};

/** Search pages the weekly check cannot open, and why. Each was seen working in a regular browser. */
export const uncheckedSearchPages: Partial<Record<CarrierId, string>> = {
  'aaa-cooper': 'www.aaacooper.com refuses connections from many networks; an archived copy of the home page shows its Action Trac number field',
  'best-express-vn': 'www.best-inc.vn sends phone-sized screens to a tracking page that renders blank in automated browsers; the desktop page has the waybill field',
  'daylight-transport': 'the Track PRO # field sits in the desktop header of dylt.com, which the phone-size check does not show',
  dellin: 'the tracker answers automated browsers with a Qrator check (HTTP 401); in a regular browser it shows its order-number field',
  'designer-transport': 'the tracker names its field search, which the check reads as a site search',
  dtdc: 'www.dtdc.com refuses connections from many networks outside India; an archived phone-size copy shows its number field',
  'emirates-post': 'emiratespost.ae answers 403 to many networks outside the UAE; an archived copy shows its number field',
  'hi-trans': 'www.hi-trans.com.au challenges automated browsers; in a regular browser its home page has the consignment number field',
  'hr-parcel': 'the tracker names its field q, which the check reads as a site search',
  'israel-post': 'israelpost.co.il answers 403 to many networks outside Israel; an archived copy shows its item-number field',
  'la-poste-tunisienne': 'www.poste.tn does not answer connections from outside Tunisia; an archived copy of its home page shows the item-number field',
  'mailplus-au': 'the tracker names its field search, which the check reads as a site search',
  'midland-transport': 'the tracking-number field sits in the desktop navigation bar of the tracker, which the phone-size check does not show',
  'nepal-post': 'pits.gpo.gov.np does not answer connections from outside Nepal; to a Nepali network it shows its item-number field',
  'olva-courier': 'the tracker names its field q, which the check reads as a site search',
  'ozon-logistics': 'tracking.ozon.ru answers automated browsers with a bot check; in a regular browser it shows the tracking number field',
  paxel: 'paxel.co answers automated browsers with a Cloudflare block (HTTP 403); in a regular browser its page script fills and submits the AWB field',
  'polaris-transport': 'polaristransport.com does not answer from many networks; its trace page has the PRO number field',
  'pony-express': 'www.ponyexpress.ru answers 403 to many networks outside Russia; an archived copy shows its waybill field',
  postaplus: 'postaplus.com draws its tracking form late in a script app, after the automated check gives up',
  saee: 'saee.sa answers 503 to automated checks from many networks; archived copies of its tracking page show the waybill field',
  'spee-dee': 'the tracking form is a frame from packages.speedeedelivery.com, which drops connections from many networks',
  'surat-kargo': 'www.suratkargo.com.tr answers a Cloudflare block to many networks outside Turkey; an archived copy shows its number field',
  'thailand-post': 'some of the tracker\'s servers stall on its script bundles, so the form often stays empty past the render window',
  'total-express': 'totalconecta.totalexpress.com.br answers many networks with an Akamai Access Denied page; to the networks it lets through it shows its number field',
  'ward-trucking': 'wardtlctools.com refuses connections from many networks; an archived copy shows its PRO number fields',
};
