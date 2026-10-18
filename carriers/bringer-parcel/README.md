# Bringer Parcel Xpress

Bringer Parcel Xpress parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Bringer Parcel Xpress (BPX, formerly Bringer Parcel Services) is the e-commerce parcel service
of the Bringer group in Miami. It ships from the United States to Latin America and hands
Brazilian parcels to Correios. Its API documentation calls its own number the BPS tracking
number and gives examples of `BPS` and twelve or thirteen letters and digits.
`bringer-parcel-1` claims that layout with low confidence, since only documentation examples
are known. Parcels also carry first-mile and external numbers of other carriers, which stay
with those carriers.

## Links

The tracking form opens one parcel at `bringerparcel.com/tracking/{number}`. The library reads
the number from that address.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
