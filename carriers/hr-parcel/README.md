# HR Parcel

HR Parcel parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

HR Parcel is an Italian parcel service of the Sailpost group that delivers e-commerce
parcels, many from Chinese and German senders. Its own barcodes are fourteen digits, as
archived lookups on its tracker and reviews it answered show, sometimes with the sender's
number as the reference. Fourteen digits are shared by many carriers, so no rule claims
them. Some senders' parcels, Mango's for one, carry a twenty-digit SSCC, which no HR Parcel
rule claims either.

Customers also quote partner numbers: iHerb's `IHB` numbers, which archived lookups show
searched as barcodes, Hermes Germany's numbers for parcels Hermes hands over in Italy, and
YunExpress numbers, which HR Parcel keeps as references. Those stay with the carriers that
issue them.

## Links

HR Parcel's tracker fills its barcode search from `?barcode=` and searches when the page
opens, so `hrparcel.com/traccia-spedizioni/?barcode={number}` opens one parcel. Archived
lookups also use the English page `hrparcel.com/en/tracking/?barcode={number}`. The library
reads the number from both.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
