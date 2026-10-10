# Express One

Express One parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Express One's tracker takes a parcel ID or barcode number, or a sender's reference or document
number together with the sender's five-digit company code. Lookups archived from it show
twenty-four-digit parcel numbers, whose last four digits repeat the destination postcode, so
the corpus keeps none of them, and twice thirteen digits. Both are bare digit runs that other
carriers share, so no rule claims them and the user picks Express One.

## Links

Express One's tracking form sends the number as `plc_number` to `tracking.expressone.hu`, so
`tracking.expressone.hu/?plc_number={number}` opens one parcel.

## Testing

Provider live-test inputs and commands are in the [provider READMEs](../../providers/README.md).
