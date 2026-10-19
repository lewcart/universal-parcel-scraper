# Qwintry

Qwintry parcels use enabled universal providers. There is no dedicated adapter.

Qwintry is a US parcel forwarder and fulfilment service. Its own air service, Qwintry Air,
carries parcels from its US consolidation hub by air to the destination country, where a local
delivery service takes over.

## Numbers

Qwintry's tracker shows its number as `QRXXXXXXXX`, and archived lookups show `QR` and eight
digits with whole histories. `qwintry-1` claims that layout. TNT Italy's low rule accepts any
two letters and eight digits, so it stays a suggestion there. The tracker also follows Russian
Post international numbers for parcels Qwintry handed to the post; generic postal detection
handles those. Later histories also print the local carrier's own number, while Qwintry's
number keeps the whole history.

## Links

The tracking form sends the number as `tracking` to `logistics.qwintry.com/track`, so
`logistics.qwintry.com/track?tracking={number}` opens one parcel. The library reads the number
from that link.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
