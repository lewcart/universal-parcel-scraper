# Pathao Courier

Pathao Courier parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Pathao consignment IDs have fourteen characters: `D`, a letter, the creation date as day, month
and two-digit year, and six letters and digits. Archived replies of Pathao's tracking service
and its developer documentation show them, and `pathao-courier-1` claims the layout.

## Links

The tracking form on pathao.com opens Pathao's merchant site with the ID as `consignment_id`,
so `merchant.pathao.com/public-tracking?consignment_id={number}` opens one parcel. Links to
`merchant.pathao.com/tracking` carry the same parameter next to the recipient's phone number;
only the ID is read.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
