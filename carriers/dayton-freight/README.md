# Dayton Freight

Dayton Freight shipments use enabled universal providers. There is no dedicated adapter.

## Numbers

Dayton Freight tracks less-than-truckload freight by its PRO number. Lookups archived from its
own tracker show eight-digit PROs, and the same PROs padded with zeros to eleven digits, the
barcode form Dayton Freight's electronic PRO page describes. Both lengths are shared by many
carriers and Dayton Freight's PROs carry no check digit, so no rule claims them; a caller names
the carrier or pastes a tracking page link.

## Links

The tracker opens one shipment at `tools.daytonfreight.com/tracking/detail/{number}`. The
carrier's home page sends its tracking form to the same page with the number in `id`, and its
former status pages took the number in `pro`. The library reads the number from each form.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
