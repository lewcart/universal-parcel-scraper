# 4Sides

4Sides parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

4Sides is a Moscow and Saint Petersburg courier for corporate documents and freight. Its
waybill barcode, which its own label rules and tracker describe, is two letters FS or FE, nine
digits and RU: the UPU S10 layout with the Russian country code, although 4Sides is not a
postal operator. Generic postal detection already claims that layout, so no rule is added and
the gap is declared; the corpus number is a waybill a customer quoted in a review.

## Links

The tracking page reads the waybill number from its `number` query parameter and looks it up
on load, so that address opens one parcel.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
