# TOPTRANS

TOPTRANS parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

TOPTRANS's tracking form takes a shipment number, a piece number or a reference. Archived
lookups on its tracking service show eleven-digit shipment numbers and thirteen-digit piece
numbers, one per piece of a shipment. Both are bare digit runs that other carriers also print,
so no rule claims them.

## Links

TOPTRANS's tracking service on `apis.toptrans.cz/tracking` reads a shipment number from
`?parcel_number=` and a piece number from `?item_number=`, as archived lookups show. The
tracking page on `toptrans.cz` posts its form and has no address for one parcel.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
