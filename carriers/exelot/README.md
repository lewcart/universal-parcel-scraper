# Exelot

Exelot parcels use enabled universal providers. There is no dedicated adapter.

Exelot is a cross-border e-commerce carrier. Its tracker follows parcels from origin warehouses
through flights and customs to delivery, mainly into Israel.

## Numbers

Exelot numbers are `XLT` followed by nine digits, which `exelot-1` claims. Purolator's
three-letter rule leaves that prefix to Exelot, as it does for other carriers' prefixes.

## Links

The tracking box on `exelot.com` opens `go.exelot.com/tracking?barcodes={number}`. Older
pages used `myparcel.exelot.com/tracking?barcodes={number}` and
`public.exelot.com/tracking/{number}`. The library reads the number from any of these
addresses.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
