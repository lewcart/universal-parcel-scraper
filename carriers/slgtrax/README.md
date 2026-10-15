# SLGTrax

SLGTrax parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Trax, now part of SLGTrax, tracks parcels by fourteen-digit numbers, as archived lookups on its
trackers show. Fourteen digits are printed by many carriers and no known prefix or check digit
sets Trax apart, so no rule claims them; a caller names the carrier or pastes a tracking page
link.

## Links

The tracking page on sonic.pk takes the number in a form that it posts, so no address opens one
parcel. Archived addresses carry the number in `tracking_number` on sonic.pk and in
`parcel_list` on the former trax.pk tracker, and slgtrax.com opens its tracking box when an
address has `tracking_number`. The library reads the number from these.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
