# Leopards Courier

Leopards Courier parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Leopards tracking numbers seen on its trackers are two letters followed by nine or ten digits.
Many carriers print two letters and nine or ten digits, so no rule claims them; a caller names
the carrier or pastes a tracking page link.

## Links

The search box on pk.leopardscourier.com keeps a found parcel in the session, so no address
opens one parcel. A failed lookup opens `/shipment_tracking_view` with the number in
`cn_number`, and the library reads the number from that address.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
