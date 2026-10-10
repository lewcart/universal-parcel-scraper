# DPD Ireland

DPD Ireland parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

DPD Ireland's tracker takes a consignment number. Lookups archived from it show nine digits in
nearly every case, and ten digits twice, once on the former QuickTrack page. DPD Ireland
publishes no check digit, and nine and ten digits are shared with TNT, DHL and several other
carriers, so no rule claims them and the user picks DPD Ireland. None of the archived lookups
uses the fourteen-digit parcel number of the other DPD networks.

## Links

DPD Ireland's tracking forms send the number as `consignmentNumber` to `www.dpd.ie/tracking/`,
which shows the result from `tracking.dpd.ie` in a frame. Lookups archived from `dpd.ie` carry
the same parameter in the address, so `www.dpd.ie/tracking/?consignmentNumber={number}` opens
one consignment.

## Testing

Provider live-test inputs and commands are in the [provider READMEs](../../providers/README.md).
