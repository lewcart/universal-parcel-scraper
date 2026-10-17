# ShipBlu

ShipBlu parcels use enabled universal providers. There is no dedicated adapter.

ShipBlu is an Egyptian delivery company for online merchants.

## Numbers

ShipBlu numbers are digits only: its site accepts seven or more digits starting with 1 to 4,
and its API documentation shows eleven and twelve digits. Such digit runs are common to many
carriers, so no rule claims them.

## Links

The tracking box on `shipblu.com` opens `go.shipblu.com/{lang}/{number}`, with `en` or `ar`;
the library reads the number from that address.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
