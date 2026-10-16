# Jeebly

Jeebly parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Jeebly air waybill numbers start with `JB`. Archived lookups on Jeebly's tracker show `JB`
followed by seven digits, and `jeebly-1` claims that layout with low confidence: a two-letter
prefix and seven digits is a common reference shape. Jeebly's API and webhook documentation
shows six digits after `JB` or `JBP`. No rule claims those documentation layouts.

## Links

Jeebly's tracking form needs the delivery service as well as the number, so no address opens
one parcel from the number alone. Links to the tracking form and to its result page carry the
number in `awb`.

## Testing

Provider live-test inputs and commands are in the [provider
READMEs](../../providers/README.md).
