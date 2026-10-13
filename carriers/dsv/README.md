# DSV

Tracks DSV shipments through the public track and trace of myDSV, the page at
`mydsv.com/track-shipment`. Former DB Schenker shipments are not in it; they fall back to the
enabled universal providers.

## How it works

The page asks three JSON services on `mydsv.com`, and the adapter does the same with plain HTTP,
without an account, key or cookie:

1. `GET /app/search/publicShipmentList?q={number}` lists the shipments whose shipment, booking,
   quote, house bill, master bill, waybill or carrier tracking id matches the number. Each comes
   with its ids, mode of transport and a key that opens its details.
2. `GET /app/search/shipment/{key}?detailedMilestones=true` holds the shipment's details. The
   adapter asks for them only to read the house bill number when the search matched none of the
   shipment's own ids.
3. `GET /app/search/shipment/new-statuses/{key}` holds the history the page's Track & Trace tab
   shows.

A lookup that fails to reach myDSV is sent once more within the budget. HTTP errors, block
pages and malformed replies keep their own failure kinds; a missing route is a transport failure.

## Former DB Schenker shipments

DSV tracks former DB Schenker shipments on a separate tracker, `www.dsv.com/mydsv/tracking-public`,
which `dbschenker.com` redirects to. Its API under `/nges-portal/api/public/tracking-public/`, on
`www.dsv.com` and `mydsv.dsv.com`, answers every lookup with HTTP 429 and a `Captcha-Puzzle`
header, a signed proof-of-work puzzle the client must solve and send back. The public browser
client solves it and repeats the lookup. The official DSV Tracking app
(`com.dbschenker.mobile.connect2schenker`) calls the same API. A dedicated route still needs
a matching shipment response to establish its history and clocks, so those shipments
stay with the universal providers.

## Notes

The shipment belongs to the number when the search names it as one of the shipment's own ids:
its shipment id, booking id or main transport id, or, from the details, its house bill. A match
on anything else, such as a master bill or a partner's tracking id, can belong to another
carrier's consignment and is left inconclusive, and so are several shipments for one number.
An empty search is inconclusive too: the number may be a former DB Schenker one, or one the
search knows only with its dashes.

The history comes in milestone groups: the booking, the pickup or receipt, the departures and
arrivals of the main carriage, and the handover. When the reply has port data, the adapter reads
the groups before and after the main carriage and each port's own departures and arrivals, as the
page lists them. Earlier values of a row are kept out of the history, except for XPRESS
shipments, whose page lists them as rows. Each row keeps DSV's date type as its code, its
English wording and its place, without postcodes. Estimated and requested dates are not scans
and are left out; the estimated delivery is the delivery estimate until the shipment is
delivered. "Handover responsibility of cargo" (`Z70`) ends DSV's service and completes the
shipment.

Clocks are the wall clocks of each place, without an offset, so they stay local. A booking comes
with its day alone.

The parties, their towns and postcodes, the references, contacts, proofs of delivery and the
shipment key are not read.

## Limitations

The search takes the number as typed, and the tracker passes it without dashes, so a shipment id
that DSV prints with a dash is not found. The page also asks a real-time tracking service for
XPRESS shipments; the adapter does not. A road shipment's history can hold only its booking.

## Testing

Set `DSV_TRACKING_NUMBER` outside the repository and run
`npm run test:carriers:live -- carriers/dsv/adapter.live.test.ts`.
Optionally set `DSV_UNKNOWN_NUMBER` to check a number myDSV does not know.
