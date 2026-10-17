# Liccardi Express Courier

Liccardi Express Courier parcels use enabled universal providers. There is no dedicated
adapter.

## Numbers

F.lli Liccardi is a courier from the Naples area with branches across Italy. Its help page
says its tracking number is seven digits or starts with `66`. Complaints and reviews quote
thirteen digits starting `660`, and eight digits, which Liccardi answered as a shipment.
Five carriers already match thirteen digits, and seven and eight digits are shared by many
more, so detection leaves Liccardi's numbers unclaimed.

## Links

The tracker on `my.liccarditrasporti.com/segui` reads the number from `?ldv=` and searches
for it when the page opens, so `my.liccarditrasporti.com/segui?ldv={number}` opens one
shipment. The library reads the number from that address.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
