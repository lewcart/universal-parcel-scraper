# RPX

RPX parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

RPX AWBs are twelve digits in its API documentation and on its corporate AWB print service.
Many carriers use twelve-digit waybills, so RPX has no rule.

## Links

RPX's tracking page takes the AWB or a reference number in its `tracking_number[]` parameter,
then asks for the last five digits of the recipient's phone number and a security check before
it shows the history. Because of that step, the catalog has no address that opens one parcel.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
