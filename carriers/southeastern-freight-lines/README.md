# Southeastern Freight Lines

Southeastern Freight Lines freight shipments use enabled universal providers. There is no
dedicated adapter.

## Numbers

SEFL tracks shipments by PRO number. Its tracing page asks for seven or nine digits, without
the terminal code, leading zeros or dash. Lookups archived from its tracker show both lengths,
and Ship24 gives nine-digit samples. Both lengths are shared by many carriers, so no rule
claims them. The tracer also searches by bill of lading, purchase order, pickup and quote
numbers, which are not tracking numbers.

## Links

SEFL's tracker prints a live tracing link that reads a PRO number from `?RefNum1=` on
`sefl.com/webconnect/tracing`, with `Type=PN`.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
