# Post Haste

Post Haste is a Freightways courier that picks up and delivers parcels across New Zealand.
Tracked through the Freightways lookup under Post Haste's name, which New Zealand Couriers'
adapter also reads.

## How it works

1. `direct`: one `GET https://public-website.ep-prod.freightways.co.nz/public-website/v1/carriers/PostHaste/tracking-events`.
   A courier ticket goes as `?searchType=TK&ticketProductCode={code}&query={number}`, a charge
   label, SSCC or customer printed label's consignment number as `?query={number}`. The number
   loses its leading zeros unless it is a 20-digit SSCC or a consignment number. It needs no
   cookie, token, key or browser. The JSON reply is the consignment with each of its parcels'
   scans, oldest first.

- An unknown number is an empty HTTP 204. A 404 or a redirect is a moved route.
- A consignment number, a sender's letters then digits, often fits a ticket's layout. Such a
  number is asked as a ticket first, then whole when the ticket gets a 204, in one step.
- The reply's `shortConsignmentId` must be the number asked: the ticket's product code and
  number, the label alone, or a consignment number after the sender's account number.
- Recognition is off. The lookup answers for every Freightways network, and New Zealand
  Couriers prints the same tickets and labels, so a known answer would not show that a number is
  Post Haste's.

## Notes

- The tracking page on posthaste.co.nz asks the same consignment through its web agency's proxy,
  `web-api.freightways.makerdesign.co.nz/track`. Post Haste's receiver site carries the direct
  lookup in its script, and New Zealand Couriers' page makes it, so the adapter asks Freightways
  directly with New Zealand Couriers' tracker and parser
  ([adapter.ts](../nz-couriers/adapter.ts), [parser.ts](../nz-couriers/parser.ts)).
- Scan times are UTC instants, kept as they are. Scan types share New Zealand Couriers' status
  map.
- Each scan names the Freightways network that made it. When the newest is another catalog
  carrier's, such as New Zealand Couriers, that carrier becomes the delivery carrier.
- The reply's `ETA`, which the page does not show, is a weekday and a date without a year. It is
  dated from the parcel's first scan and kept only when the weekday agrees.
- Signatures with the signatory's name, delivery photos, the authority-to-leave tag, the
  barcode, postcodes, branches, drivers and runs are not kept.

## Limitations

- A customer printed label is read only by a consignment number of letters then six to eight
  digits, as on the labels seen, so a number of another carrier's layout, such as Purolator's
  three letters and nine digits, is refused. Contract bags and manifest references are not read.
- A consignment the tracker no longer holds reads as not found.
- No weight or service.

## Numbers

A courier ticket or Express Pack carries a product code of up to four letters and an eight-digit
ticket number, which the advanced tracker takes as two fields; the corpus writes them with a
space between. Charge labels carry an eight-digit label number. Customer printed labels pair the
sender's account number with a consignment number, so they are not kept. The track and trace
page gives the samples, and archived lookups on the tracker give the tickets. New Zealand
Couriers, another Freightways brand, prints tickets in the same layout, and eight digits are
shared by many carriers, so no rule claims either.

## Links

The site's search box sends a number to `posthaste.co.nz/track?query={number}`. The older servlet
at `/phl/servlet/ITNG_TAndTServlet` needs the product code and ticket number as separate
parameters, so it is not read.

## Testing

`npm run test:carriers:live -- carriers/post-haste`, with `POST_HASTE_TRACKING_NUMBER` and
optionally `POST_HASTE_UNKNOWN_NUMBER` set outside the repository.
