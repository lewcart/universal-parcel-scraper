# Anousith Logistics

Anousith Logistics parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Anousith parcel numbers have thirteen digits: its public search refuses shorter input. Its
tracker page carries one such number in its share metadata. Thirteen digits are shared by
several carriers and nothing in the number points to Anousith, so no rule claims them.

## Links

The public search opens one parcel at
`app.anousith.express/landing/search_tracking/search_item` with the number as `_bill_detail`.
A shared bill opens at `bill_share` beside it, with the number as `tacking_number`.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
