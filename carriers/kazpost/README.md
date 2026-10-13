# Kazpost

Kazpost parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Kazpost prints UPU S10 numbers ending in `KZ`, and its tracker takes only that layout of two
letters, nine digits and two letters. Archived lookups on post.kz show Kazpost items starting
`EL` and `GH`, and customers quote `RR` registered items. Generic postal detection handles S10
numbers, so Kazpost has no rule of its own. The tracker also answers incoming items with other
posts' suffixes; those stay with the posts that issued them.

## Links

post.kz opens one parcel at `/mail/search/track/{number}/detail`, as archived lookups on its
own host show; older lookups leave out `/detail`. The former tracker at track.kazpost.kz now
sends visitors to post.kz.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
