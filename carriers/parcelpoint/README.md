# ParcelPoint

ParcelPoint parcels use enabled universal providers. There is no dedicated adapter.

ParcelPoint is HUBBED's network of pickup and drop-off points in Australian shops, branded
PARCELPOINT. Partner carriers deliver parcels to the points and collect returns from them, so
a parcel waiting at a point usually also has its carrier's number. The hubbed.com tracking
page searches the same network.

## Numbers

ParcelPoint's oldest archived lookups on its tracker show references of four to six letters
and digits starting with 60 or 70, a dash and eight letters and digits. The current tracker
shows booking codes and consignment ids whose layout no public source shows, so no rule claims
either and detection does not offer ParcelPoint.

## Links

`parcelpoint.com.au/track-your-parcel/` with `trackingnumber` or `trackingId` opens one
parcel, and the tracker rewrites its address to that form after a search. Older links put the
reference in the path, `/track/<reference>`. On hubbed.com, `/track-parcel/` reads `locate` or
`hubbed_track_parcel_tracking_no`.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
