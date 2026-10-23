# Shouwu International

Shouwu International is 上海守务国际, a Shanghai cross-border forwarder. Universal providers name
it SWE. Its parcels use enabled universal providers; there is no dedicated adapter yet.

## Numbers

Its waybills are SWECN, twelve digits and YQ. The twelve digits open with the date. A parcel a
universal provider filed under SWE has that layout and Shouwu's own tracker answers it, and no
other carrier's rule takes it, so `shouwu-1` has high confidence.

## Links

`admin.shshouwu.com/track.html?q=` followed by the number opens a parcel. The customer portal on
sedel.com sends its tracking box there.

## Adapter lead

The tracker's script asks `POST /api/freight/order/PubOrder/getOrderTrace` on
admin.shshouwu.com, without a cookie or account, with `{"strs":[…]}`. The reply's `data` has one
entry per number it knows: `order` with `orderNo` the number, `traceStatus`, `traceStatusDesc`
and the destination's `countryCodeTwo`, and `traces` with `traceTime` in epoch seconds,
`traceDesc`, `traceLocation` and `traceType`. The page reads a number missing from `data` as not
found.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
