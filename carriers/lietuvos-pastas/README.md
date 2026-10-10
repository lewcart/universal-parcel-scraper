# Lietuvos paštas

Lietuvos paštas items and LP Express parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

LP Express parcel numbers are `CC`, `CH` or `HC`, nine digits and `LT`. They borrow the UPU S10
layout, but most of those in lookups archived from LP Express's tracker fail its check digit,
so the generic postal carrier does not take them. `lietuvos-pastas-1` suggests Lietuvos paštas
at low confidence, because Chronopost's rule for any S10-shaped number also matches; when the
check digit passes, the generic postal carrier decides. Lietuvos paštas's own items, such as
`EB` express mail and `RN` registered items ending `LT`, use the UPU S10 layout and stay with
the generic postal carrier.

## Links

LP Express's tracker opens one parcel at `lpexpress.lt/track?parcel={number}`, the address its
copy-link button builds. Archived lookups also used `lpexpress.lt/track/id/{number}`,
`lpexpress.lt/tracking/{number}` and the `num` parameter of the former parcel search on
`post.lt`. The current tracker on `post.lt` posts its form behind a proof-of-work check, so no
address there opens a result.

## Testing

Provider live-test inputs and commands are in the [provider READMEs](../../providers/README.md).
