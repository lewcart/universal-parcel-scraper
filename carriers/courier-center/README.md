# Courier Center

Courier Center parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Courier Center waybills seen in lookups archived from its tracker and in an aggregator's
samples are twelve digits starting `013`. Twelve digits are shared with Speedex and other
carriers, so no rule claims them. The tracker also answers DHL parcel numbers that Courier
Center delivers; those stay with DHL.

## Links

The tracking form posts the number as `tracknr` to `www.courier.gr/track/result/`, and archived
lookups show the same page answering `?tracknr={number}` in the address, so that address opens
one parcel.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
