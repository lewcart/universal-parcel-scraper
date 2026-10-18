# ShipEntegra

ShipEntegra parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

ShipEntegra is a Turkish cross-border shipping company for online sellers. It takes parcels in
at its own Istanbul transfer centre and sells UPS, FedEx and DHL labels, whose numbers belong
to those carriers. Its own line carries ShipEntegra numbers and hands parcels to a partner
carrier for delivery abroad.

On its tracker those numbers read 1SE followed by the nine-digit label number; customers also
quote the nine digits alone. Rule shipentegra-1 claims 1SE and nine digits with high
confidence. The bare nine digits stay unclaimed because many carriers use short digit runs.

## Links

One parcel opens on track.shipentegra.com with the number in the `trackno` parameter. The
tracker's share link builds that address from the current page, and the tracker also reads
several numbers separated by commas or spaces from it. The library reads the number from it.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
