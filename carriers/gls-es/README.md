# GLS Spain

GLS Spain's shipments, tracked by number and delivery postcode through the service behind
its tracking page, mygls.gls-spain.es. The same service answers GLS Portugal's shipments with
a Portuguese postcode.

## How it works

1. `direct`: one `POST https://api.consignee.gls-spain.es/api/v5/expeditions/find` with
   `{"find":{"reference":number,"destination":{"address":{"postalCode":postcode}}}}`, as the
   tracking page sends it, in its English locale. The JSON reply carries the shipment's state
   and its whole history. No cookie, session, account or browser is needed.
2. `retry`: one more try when the request fails to reach GLS or hangs. The first try gets
   half of the budget.

- The page signs each request: `X-Timestamp` is the current instant and `X-Signature` the
  hex HMAC-SHA256 of `POST`, the path `/expeditions/find` and that timestamp, one per line.
  The key is a secret every visitor's page receives from Firebase Remote Config; the adapter
  includes it with the maintainer's approval. The service refuses a timestamp minutes off
  its clock, so every try signs anew.
- The postcode is required. The service looks up the whole number with it: a number or
  postcode one character off is not found.
- A number GLS does not know with that postcode returns HTTP 404 with its `notFound` error:
  `NotFoundError`. Any other error reply or web page is inconclusive, and a bot check is a
  challenge. A rejected signature is HTTP 401 or 403, which the transport reports as a
  challenge.
- No recognition: without the postcode the service answers nothing.

## Notes

- The service matches the shipment number, a parcel's barcode or the sender's reference, and
  the reply names its shipment number but does not echo every barcode or reference. The
  shipment number is returned as `canonical_tracking_number` when the lookup used another.
- Each scan carries a state code, the same as the shipment's current state. The codes are
  mapped in [status.ts](status.ts); `incidence` scans are read by their sentence, which says
  whether nobody was in, the parcel was refused or it was sent on to a GLS point. `stored` is
  left to the shared wording rules.
- Clocks carry `Z`, and the page shows them in the reader's zone, so they are kept as
  instants.
- The weight, the estimated delivery day and the GLS point a parcel waits at are kept. The
  point is named only when the scan that left the parcel there names it too; otherwise the
  reply's point is the destination depot.
- The addresses, the sender, the recipient and their identity document, the point's
  collection code, PIN and deadline, the sender's reference and the scans' reasons are never
  read.

## Numbers

Shipment numbers are nine or ten digits, and those in public OCU complaints are ten digits
starting `1`. Labels also carry longer parcel barcodes, and the sender's reference works too.
GLS publishes no length or check-digit rule, and these lengths are shared with several
carriers, so no rule claims them and the user picks GLS Spain.

## Links

The link opens GLS Spain's tracking page on gls-group.com without the number: its form asks
for the delivery postcode too, and a page given the number alone ignores it. The form opens
`mygls.gls-spain.es/e/{number}/{postcode}/es`, and notifications link to
`mygls.gls-spain.es/e/{number}/{postcode}`. Only the number is read from these links, from
older `mygls.gls-spain.es/e/?codigo={number}` links, which now land on a not-found page, and
from the group tracker's `?match=`.

## Limitations

- A reference with characters other than letters and digits cannot be looked up.
- A shipment forwarded or returned under a new number is not followed.
- No scan location, service name or sender name.

## Testing

```sh
GLS_ES_TRACKING_NUMBER=... GLS_ES_POSTCODE=... GLS_ES_UNKNOWN_NUMBER=... npm run test:carriers:live -- carriers/gls-es
```
