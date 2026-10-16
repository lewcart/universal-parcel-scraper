# Raben

Raben Group is a European road freight and contract logistics group, with groupage networks
across Central and Eastern Europe. Tracked through the lookup its myRaben tracking page makes.

## How it works

1. `direct`: `GET https://oftc.myraben.com/link/ShipmentInformation?ShipmentNumber={number}&Language=EN`,
   the deep link Raben's tracking box opens. Its 303 starts an anonymous session of the myRaben
   app in the `XASSESSIONID` and `XASID` cookies. Then one `POST https://oftc.myraben.com/xas/`
   with those cookies and the page's own `get_session_data` request. The JSON reply holds the
   page the session opens, the shipment with its status rows, and the English captions. It needs
   no account, key, token or browser.
2. `retry`: an attempt that fails to reach myRaben, or hangs, gets one more in a new session.
   The first gets half of the budget.

- An unknown number opens the page saying the shipment could not be found, which is not found.
  Another page is inconclusive. A 403 or a firewall page is a challenge and a 429 a rate limit. A
  404 or a redirect from the session endpoint is a moved route, and a 401 there a session the
  server refused.
- The search box also takes references and colli labels, and opens the shipment they belong to.
  The session's search and the shipment's `ShipmentNumber` must both be the whole number asked;
  a shipment under another number is inconclusive, with the reason `reference_only`.
- Recognition makes the same requests.

## Notes

- The reply lists each object with empty attributes and gives their values in `changes`, which
  the parser lays over them. Status rows point to their shipment; rows of another are left out.
- The objects come in no set order. Rows are sorted newest first, and of two at the same instant
  the one with the higher `Sequence` comes first, as on the page.
- A row's `TimeStamp` is an instant, which the page shows in the visitor's own zone. The adapter
  writes it in the zone of the row's country, or in UTC for a country with several zones or one
  it does not know.
- A status is a key such as `E03_The_shipment_delivered`, captioned in the language the link
  asks for. The `E03` is the provider code and sets the stage; the caption is the description.
  A new delivery or collection day, a booked collection and updated shipment data move nothing.
  A failed delivery at the address is a failed attempt; a failed collection, or a delay on the
  road, is an exception.
- The planned delivery day is a date without a time. It is read as a calendar day in Warsaw and
  dropped once the shipment is delivered.
- The gross weight is kept. Colli, volume, the progress rail, remarks and the customer-service
  depot with its phone numbers are not.

## Limitations

- No sender, recipient, address, service or proof of delivery.
- The reply's delivery window, `EtaFrom` and `EtaTo`, is not read.
- Older shipments drop out of myRaben and then read as not found.

## Numbers

Raben's tracking box asks for the shipment number. Lookups archived from its myRaben shipment
page and Raben's own customer guides show fifteen-digit numbers. Fifteen-digit runs are printed
by several parcel carriers, so no rule claims them and preflight does not ask Raben about them.
The samples and their sources are in [`numbers.json`](numbers.json).

## Links

The tracking box on Raben's site sends the number as `ShipmentNumber` to
`/link/ShipmentInformation` on `oftc.myraben.com`, which opens one shipment without an account.
Archived lookups and shop integrations use the same path on `myraben.com`.

## Testing

`npm run test:carriers:live -- carriers/raben`, with `RABEN_TRACKING_NUMBER` and optionally
`RABEN_UNKNOWN_NUMBER` set outside the repository.
