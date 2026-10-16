# ArrowXL

ArrowXL parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

ArrowXL's tracker asks for the tracking reference and the delivery postcode. Its help page
says the reference is usually 10 to 13 characters of letters and digits, and the archived
tracker asked for 13 characters starting with `8` and ending in a letter. Lookups archived
from the tracker and an aggregator's sample carry that reference with a three-digit suffix,
16 characters in all. Yodel prints the same layout, so no ArrowXL rule claims it.

## Links

The tracking form sends the reference as `upi` to `askaxl.co.uk/tracking`, but the tracker
shows a delivery only with the postcode, so no address opens one parcel. Archived lookups put
the reference in `upi` on `askaxl.co.uk/tracking` and on the former `arrowxl.co.uk/tracking`,
or in the first path segment after `askaxl.co.uk/trk/`; only the reference is read from them.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
