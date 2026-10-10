# Stallion Express

Stallion Express parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Stallion's own shipment codes, in lookups archived from its tracker, are ten characters: six
digits that read as the shipping date, year first, and four letters and digits.
`stallion-express-1` suggests Stallion Express at low confidence when the six digits form a
date and the four hold a letter; with four digits the code would be ten digits, a shape many
carriers share. The tracker also answers the numbers of the carriers Stallion hands parcels to,
such as USPS and PostNL, which stay with those carriers.

## Links

Stallion's tracking page at `stallion.ca/track/` reads the number from its `tracking` parameter
and looks it up at once, so `stallion.ca/track/?tracking={number}` opens one shipment. Archived
lookups used the same parameter on the former `stallionexpress.ca`, and the shipping app opened
one at `ship.stallionexpress.ca/track/{number}`.

## Testing

Provider live-test inputs and commands are in the [provider READMEs](../../providers/README.md).
