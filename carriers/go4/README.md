# GO4

GO4 parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

GO4 is a Bratislava courier. Its tracker asks for a shipment number that starts with 1 and has
ten digits, or starts with 2 and has eleven. In the tracker's own sample record the first six
digits are the order date. Many carriers print bare digit runs of these lengths, so no rule
claims them.

## Links

The tracker reads the number from the `parcelId` parameter, so
`zona.go4.eu/status/?parcelId={number}` opens one parcel.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
