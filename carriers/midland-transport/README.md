# Midland Transport

Midland Transport shipments use enabled universal providers. There is no dedicated adapter.

## Numbers

Lookups archived from Midland's tracker show Midland Courier parcels with sixteen-digit
numbers ending in a four-digit package counter. Sixteen digits are shared by many carriers
and nothing in the number points to Midland, so no rule claims them; a caller names the
carrier or pastes a tracking page link. No public source shows a Midland LTL probill.

## Links

The home page's quick track field opens one shipment at
`ship.midlandtransport.com/Tracking/TrackClientTrackings` with the number in
`TrackingNumber`. The library reads the number from that address.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
