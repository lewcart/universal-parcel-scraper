# GoBolt

GoBolt parcels use enabled universal providers. There is no dedicated adapter.

GoBolt, formerly Second Closet, is a Toronto delivery and fulfilment company serving Canada and
the United States.

## Numbers

GoBolt tracks parcels by the number the merchant gives, seen as twelve digits and as twelve
letters and digits in archived replies of its tracking API. Neither layout is published, and
both are shared with other carriers, so no rule claims them.

## Links

`track.gobolt.com/tracking/{number}` opens one parcel, as the tracker's routes and archived
lookups show. The older `galileo.gobolt.com` host uses the same path. Both are read as links.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
