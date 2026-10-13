# ICS Courier

ICS Courier parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

ICS tracking numbers are twenty letters and digits: `ND` for next-day or `GR` for ground
service, twelve letters and digits, then the destination postal code without its space.
Lookups archived from ICS's own tracker show both services. `ics-courier-1` claims that
layout. The tracker also takes a delivery-notice number or a reference with a postal code;
those are not tracking numbers.

## Links

The tracker reads one or more numbers from `?trackNums=` on `icscourier.ca`, on both
`/online-services/tracking.aspx` and `/online-services/parcel-tracking.aspx`.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
