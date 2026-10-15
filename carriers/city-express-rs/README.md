# City Express

City Express parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

City Express shipment numbers are a centre code, 688 001, 688 002 or 688 005, and eight
digits; a parcel within the shipment adds two more digits. Its tracker prints them in groups
and asks for the centre and the eight digits in separate fields, as archived lookups show.
`city-express-rs-1` claims the fourteen- and sixteen-digit forms that start with one of these
centre codes. The eight digits alone are a length other carriers print too and stay unclaimed.

## Links

The tracker's address carries the centre and the eight digits as separate parameters, so no
address holds the whole number.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
