# Jersey Post

Jersey Post parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Jersey Post's tracker covers items posted in Jersey on a tracked service and asks for UPU S10
numbers ending in `JE`. Lookups archived from it and an aggregator's sample show them. Generic
postal detection handles S10 numbers, so no Jersey Post rule claims them. Numbers starting
`UM` belong to an untracked service, though the tracker still relays the scans of the post
abroad for them.

## Links

The tracker's search form sends the number as `tq` to `jerseypost.com/tools/track-trace/`, and
the page it returns shows that item, so `jerseypost.com/tools/track-trace/?tq={number}` opens
one parcel. Archived lookups use the same address with and without `www`.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
