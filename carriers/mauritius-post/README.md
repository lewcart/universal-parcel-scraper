# Mauritius Post

Mauritius Post parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Mauritius Post tracks registered, parcel and EMS items by their UPU S10 numbers, which end in
`MU`. Its tracker shows local items under the same layout. Generic postal detection handles
these numbers, so no Mauritius Post rule claims them.

## Links

The tracking page reads a number from `tracking_code` on `www.mauritiuspost.mu/track-trace/`,
so one parcel opens at `www.mauritiuspost.mu/track-trace/?tracking_code={number}`.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
