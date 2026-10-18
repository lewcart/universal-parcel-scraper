# XLCourier

XLCourier parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

XLCourier's tracking page checks a number against `XLC` and ten to twelve digits, or `ZX` and
eight digits. Its API documentation uses `XLC` and eleven digits in its tracking example, and
an aggregator offers `XLC` and twelve digits. `xlcourier-1` claims the `XLC` layout. No public
`ZX` number was found, so no rule claims that layout.

## Links

The tracking page keeps the number out of its address and asks XLCourier's API for the
history, so no address opens one parcel.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
