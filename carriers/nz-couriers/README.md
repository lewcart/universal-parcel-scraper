# New Zealand Couriers

New Zealand Couriers is a Freightways courier that picks up and delivers parcels across New
Zealand. Tracked through the lookup its tracking page makes.

## How it works

1. `direct`: one `GET https://public-website.ep-prod.freightways.co.nz/public-website/v1/carriers/NZCouriers/tracking-events`,
   as the script of `nzcouriers.co.nz/track` asks it. A courier ticket goes as
   `?searchType=TK&ticketProductCode={code}&query={number}`, a label or a customer printed
   label's consignment number as `?query={number}`. The number loses its leading zeros, as on
   the page, unless it is a 20-digit SSCC or a consignment number. It needs no cookie, token,
   key or browser. The JSON reply is the consignment with each of its parcels'
   scans, oldest first.

- An unknown number is an empty HTTP 204, which the page reports as not found. A 404 or a
  redirect is a moved route.
- The lookup refuses a query of fewer than six characters with HTTP 400, so a ticket number of
  five digits once its zeros are dropped is not asked as a ticket.
- A customer printed label's consignment number, a sender's letters then digits, can fit a
  ticket's layout. Such a number is asked as a ticket first, then whole when the ticket gets a
  204, in one step.
- The reply's `shortConsignmentId` must be the number asked: the ticket's product code and
  number, or the label alone. A label can also find a customer printed label whose
  consignment number it is, which is another consignment. A customer printed label's
  consignment number, letters then digits, comes after the sender's account number.
- Recognition is off. The lookup tells a known consignment from an unknown one, but other
  carriers share eight and nine digits and SSCCs, Post Haste prints the same ticket layout,
  and the lookup answers for Freightways' other networks too, so a known answer would not show
  that a number is New Zealand Couriers'.

## Notes

- Each scan's `createdOn` is an instant in UTC and is kept as it is.
- The scan's type, with its subtype after a slash (`NOND/CARD`), is the provider code that
  stages it. A delivery scan that hands a rural parcel to the rural delivery partner,
  `Delivery Handed Over`, keeps the parcel in transit; the partner's `3P/D` scan is the
  delivery.
- A consignment of several parcels lists each parcel's scans; they are kept together, newest
  first. Like the page, the adapter shows a parcel's `Label Created` scan only when it opens the
  parcel's history.
- Each scan names the Freightways network that made it. When the newest is another catalog
  carrier's, that carrier becomes the delivery carrier.
- The reply's `ETA`, which the page does not show, is a weekday and a date without a year. It is
  dated from the parcel's first scan in New Zealand and kept only when the weekday agrees.
- Signatures with the signatory's name, delivery photos, the authority-to-leave tag, the
  barcode, postcodes, branches, drivers and runs are not kept.

## Limitations

- A customer printed label is read only by a consignment number of letters then digits; one
  of digits alone reads as a label. The page's search for an account and consignment number
  did not find labels whose consignments the lookup still holds.
- Contract bags, manifest references and other barcodes are not read.
- A consignment the tracker no longer holds reads as not found.
- No weight or service.

## Numbers

A courier ticket or pack carries a product code of two or three letters, or a letter and two
digits, and a ticket number, which the advanced tracker takes as two fields and the single
search box as one entry with a space or hyphen; the corpus writes archived tickets with a
space. Charge labels carry eight digits and international consignments nine. Customer printed
labels pair the sender's account number with a consignment number, so they are not kept. The
track-a-parcel page gives the samples, and archived lookups on the tracker give the tickets.
Post Haste, another Freightways brand, prints tickets in the same layout, and eight or nine
digits are shared by many carriers, so no rule claims them.

## Links

The search box sends a number to `nzcouriers.co.nz/track?query={number}`. The older servlet at
`/nzc/servlet/ITNG_TAndTServlet` takes a ticket as two parameters, so it is not read.

## Testing

`npm run test:carriers:live -- carriers/nz-couriers`, with `NZ_COURIERS_TRACKING_NUMBER` and
optionally `NZ_COURIERS_UNKNOWN_NUMBER` set outside the repository.
