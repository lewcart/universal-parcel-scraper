# nox

nox parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

nox Germany, formerly nox NachtExpress, Innight Express and TNT Innight, delivers business
consignments overnight. Its label specification defines the shipping barcode as 24 digits: the
client code 22, three zeros, the sender's seven-digit customer id, the print date as YYMMDD and
a six-digit serial. `nox-1` claims that layout with low confidence, since InPost, bpost, Ciblex
and Austrian Post accept any 24 digits.

Archived lookups also show barcodes of SWR and 21 digits, with the same eight digits after SWR
and then the print date. Return labels start with RA and the pickup type. Detection leaves both
layouts unclaimed.

nox Austria runs its own tracker and is not covered here.

## Links

The tracker opens one parcel at `/scannungen/` followed by the barcode. The former tracker read
it from a `pBarcode` parameter.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
