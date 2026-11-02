# TNT Australia

TNT Australia is TNT's domestic express network in Australia, now part of FedEx. Its
consignments are tracked on tntexpress.com.au; TNT's international consignments belong to
[TNT](../tnt/README.md), and tnt.com's tracker refuses a domestic one and points to
tntexpress.com.au. Tracked through the tracker's consignment history page.

## How it works

1. `direct`: one `GET https://www.tntexpress.com.au/interaction/ASPs/trackref_detail.asp?con={number}`.
   It needs no cookie, token, key or browser. The reply is a small HTML page: the number, the
   estimated delivery while one is due, and the scans oldest first, each with its wording,
   day, clock and depot.
2. `retry`: the request once more when it fails to reach the site or hangs. The first try
   gets half of the budget, so the retry fits in the rest.

- A number the tracker has no consignment for gets the table with "No consignment was found",
  read as not found. A consignment without scans gets an empty table.
- The page answers every number with HTTP 200, so a 404 or a redirect is a moved route.
- The page must name the whole number asked.
- Recognition makes the same request.

## Notes

- The tracking page itself, `Trackntrace.aspx`, redirects to an encrypted results address and
  reaches the history only through an ASP.NET postback that carries the page's view state. The
  older history page, which search engines index, reads the same scans with one request.
- Scan clocks are the depot's, to the minute, without a zone. Depots span three zones and the
  southern states keep daylight time, so scans stay `local_time`. A scan the page gives with a
  day alone keeps its day.
- Scans come without codes; their wording decides the stage in [status.ts](status.ts). The
  receiver's delivery bookings and requests for one are notes, not scans, and keep the stage
  the parcel had: one can follow the delivery, and another is dated at the booked day's close.
  "We've collected your shipment" is the sender's pickup and "Your shipment was collected" the
  receiver's collection from the depot.
- The estimate is the day the page shows; its clock is the end of the delivery day. It is not
  kept once the parcel is delivered.
- The results page's milestone rail, the sender's reference, the delivery time and the
  signatory are not read.

## Limitations

- No instants, codes, service, weight or proof of delivery.
- The history page shows one consignment for a number that several carried, as the tracking page
  lists them all.
- The tracker also finds a consignment by the sender's reference and some FedEx numbers, which
  the adapter does not take.

## Numbers

A domestic consignment is the sender account's three letters and nine digits; older ones have
seven digits. tnt.com's tracker sends three letters and nine digits to TNT Australia. The digits
carry no check, and the letters are the account's, so any three can start one: Purolator's
lettered PINs share the shape, and its rule names Purolator for it outright except where an
account's letters are known. `tnt-au-apk` names TNT Australia for `APK`, a sender account whose
consignments its tracker has listed since 2009, with nine digits or seven. A consignment of
another account is tracked when filed under TNT Australia, or from its tracking link. The
samples and their sources are in [`numbers.json`](numbers.json).

## Links

The tracking page opens one consignment at `Trackntrace.aspx?con=` followed by the number.
Links to the history page, and to the older `CnmHxAS.asp` page that takes the number as its
whole query, are read too.

## Testing

`npm run test:carriers:live -- carriers/tnt-au`, with `TNT_AU_TRACKING_NUMBER` and optionally
`TNT_AU_UNKNOWN_NUMBER` set outside the repository.
