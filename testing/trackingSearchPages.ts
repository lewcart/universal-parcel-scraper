import type { CarrierId } from '../generated/catalog.js';

/**
 * Carriers that link a parcel but have no public page to type its number in.
 * A parcel whose number is hidden shows no link to them.
 */
export const carriersWithoutSearchPage: Partial<Record<CarrierId, string>> = {
  'amazon-logistics': 'Amazon shows its own deliveries only in the buyer\'s account; no public page takes the number',
  ciblex: 'Ciblex shows parcels only in its customer extranet, behind a sign-in',
  'skynet-worldwide': 'SkyNet\'s tracker shows its number field only with a network parameter in the address, and skynetworldwide.com has no tracking page of its own',
};

/** Search pages the weekly check cannot open, and why. Each was seen working in a regular browser. */
export const uncheckedSearchPages: Partial<Record<CarrierId, string>> = {
  'aaa-cooper': 'www.aaacooper.com refuses connections from many networks; an archived copy of the home page shows its Action Trac number field',
  dellin: 'the tracker answers automated browsers with a Qrator check (HTTP 401); in a regular browser it shows its order-number field',
  dtdc: 'www.dtdc.com refuses connections from many networks outside India; an archived phone-size copy shows its number field',
  'emirates-post': 'emiratespost.ae answers 403 to many networks outside the UAE; an archived copy shows its number field',
  'israel-post': 'israelpost.co.il answers 403 to many networks outside Israel; an archived copy shows its item-number field',
  'olva-courier': 'the tracker names its field q, which the check reads as a site search',
  'spee-dee': 'the tracking form is a frame from packages.speedeedelivery.com, which drops connections from many networks',
  'surat-kargo': 'www.suratkargo.com.tr answers a Cloudflare block to many networks outside Turkey; an archived copy shows its number field',
  'thailand-post': 'some of the tracker\'s servers stall on its script bundles, so the form often stays empty past the render window',
  'ward-trucking': 'wardtlctools.com refuses connections from many networks; an archived copy shows its PRO number fields',
};
