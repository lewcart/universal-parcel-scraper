# Correos de Chile

Tracks Chilean postal references through the anonymous tracking page. The
publicly documented developer API requires customer credentials and is not used.

## How it works

A fresh page request establishes a Liferay session and CSRF token. The adapter
then calls the page's tracking resource with the complete number and checks the
returned shipment's reference and identifier before projecting scans. The resource
includes a large branch directory, so each response has a strict byte limit;
only the shipment detail is retained.

## Notes

The portal supplies scan wall clocks without offsets. They remain local-time
evidence rather than invented instants. They are Santiago's: in Chile's summer
time, Correios Brazil's copies of the same scans carry `-03:00`, Santiago's
offset then. The catalog clock is therefore Santiago's. It places a provider's
copy that has no offset, and 17TRACK's rows, labelled with Chile's winter offset
in summer too, are read on it ([17TRACK](../../providers/seventeentrack/README.md)).
Providers name the carrier "Correos Chile".

Future progress-rail markers, customer details, delivery names, identity
numbers, notices and the branch directory are excluded. Free-form status text is
replaced with a neutral update. A missing shipment response may also mean its
history expired, so it remains inconclusive.
Its not-found notice carries the reason `portal_not_found`, so a consumer can
tell the carrier's answer from an outage.

The page can return a browser challenge instead of an anonymous session, or
redirect to Radware's bot check; both are reported as challenges. Servers abroad
can be refused by the site even from a browser, so the adapter has no browser
step.

The official mobile app reads the same shipment detail, with no session, key or
bot check, from `GET https://appmovil.correos.cl/api/tracking/tracking_code/{number}/list_status`.
That host only accepts connections from Chilean networks, so the adapter does
not use it. An unknown or expired number answers there with an empty history.

## Testing

Set `CORREOS_CHILE_TRACKING_NUMBER` to an authorized real reference and
optionally `CORREOS_CHILE_UNKNOWN_NUMBER` to a valid-looking unknown reference,
then run `npm run test:carriers:live -- carriers/correos-chile`.
