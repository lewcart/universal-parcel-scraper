# NIPOST

NIPOST parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

NIPOST prints UPU S10 numbers ending in `NG`, which customers quote for registered items.
Generic postal detection handles them, so NIPOST has no rule of its own. The tracker's help
says domestic numbers may run to sixteen characters; no such number has been seen.

## Links

The tracking form sends the number as the path, so `tracking.nipost.gov.ng/{number}` opens one
parcel. Several numbers can be given at once, separated by commas.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
