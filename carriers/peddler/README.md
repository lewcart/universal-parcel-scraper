# Peddler

Peddler parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Peddler is a Dutch urban delivery service that also delivers parcels for Chinese shippers
such as Cainiao and YunExpress. Its label specification gives its own tracking number as `P`
and eighteen digits, which `peddler-1` claims. Cainiao parcels keep the number Cainiao hands
over, `NLEXP`, ten digits and `INTPED`, which Peddler's tracker follows and `peddler-2`
claims.

## Links

Peddler's tracker opens one parcel at `track.pdlr.nl/trackntrace/{number}`, as archived
lookups show. The library reads the number from that address.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
