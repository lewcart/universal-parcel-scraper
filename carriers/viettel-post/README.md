# Viettel Post

Viettel Post parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Lookups archived from Viettel Post's tracking pages show waybills of nine digits, of `V` and
eleven digits, and, on the current order page, of thirteen digits. `viettel-post-1` suggests
the `V` layout. Bare digits of these lengths are printed by other carriers too, so no rule
claims them.

## Links

The library reads the number from the current order page on `viettelpost.vn`, which takes it
as `orderNumber`, and from the former tracking page on `viettelpost.com.vn`, which took it as
`KEY`, `Key` or `id`. The current page renders in the browser and its guest view is untested,
so the library builds no address.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
