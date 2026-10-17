# Fermopoint

Fermopoint parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Fermopoint is an Italian network of shops where parcels wait for collection, part of BRT. A
collection booked with it gets a 13-character Fermoticket: a letter, four letters or digits,
two letters and six digits, as the tracking page's example and archived lookups show.
`fermopoint-1` claims that layout with low confidence, because Paquetexpress's rule takes some
of the same codes.

The home page's form also takes the number of a parcel sent through Fermopoint's shipping
service. No rule claims those.

## Links

`fermopoint.it/prenotazione/{number}` opens one booking. Archived lookups also use the former
`/fermoticket/` address, which now redirects there.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
