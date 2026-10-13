# Central Transport

Central Transport shipments use enabled universal providers. There is no dedicated adapter.

## Numbers

Central Transport tracks less-than-truckload freight by its PRO number. An archived link to its
own trace page shows a nine-digit PRO, and its document service shows an eleven-digit one
printed with dashes. Both lengths are shared by many carriers, so no rule claims them; a caller
names the carrier. Its tracking page also takes pickup numbers, which contain `PU`, and
handling-unit labels; they are not recorded.

## Links

The tracking page sends numbers in a form, so no address opens one shipment. An older trace
page took the PRO in `pro` on `centraltransport.com/confirm/trace.aspx`; the library reads the
number from it.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
