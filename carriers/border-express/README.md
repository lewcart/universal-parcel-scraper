# Border Express

Border Express parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Border Express consignments carry either a plain eight-digit number or a four-letter sender
prefix followed by a range, documented as six digits. Both shapes are shared with other
carriers, so no rule claims them. Each label unit carries a barcode made of the prefix, `BX`,
the zero-padded range and a three-digit unit number; `border-express-1` takes that barcode with
low confidence.

## Links

The website tracker, `borderexpress.com.au/tracking/`, takes the number as `cn`. The online
tracker at `bexonline.borderexpress.com.au/bxo/track` takes it as `consignmentNumber` or as a
path segment.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
