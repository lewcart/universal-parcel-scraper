# Steadfast Courier

Steadfast Courier parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Steadfast tracking codes come in two layouts. Older consignments have eight to eleven
hexadecimal characters; newer ones are `SFR`, the creation date as two-digit year, month and
day, `ST` and nine hexadecimal characters. `steadfast-1` claims the newer layout. Short
hexadecimal codes are too generic to claim.

## Links

`steadfast.com.bd/t/{code}` opens a parcel by its hexadecimal code, and the page loads the
history from `steadfast.com.bd/track/consignment/{code}`; both addresses are read. Text
messages link to `/t/` or `/tl/` with a longer private code, which is not a tracking number
and is not read.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
