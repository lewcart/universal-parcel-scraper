# Total Express

Total Express parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Total Express identifies a parcel by its AWB, ten digits in the one public example, an
open-source scraper of its tracker. Ten digits are shared by DHL and several other carriers,
so no rule claims them. Total Express's own pages also look parcels up by the merchant's order
and invoice numbers, or by the recipient's tax number, which are not tracking numbers.

## Links

No address opens one parcel by its number: the tracker's addresses carry a merchant key with
the order and invoice numbers.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
