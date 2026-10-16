# Packlink

Packlink parcels use enabled universal providers. There is no dedicated adapter.

Packlink sells shipping with other carriers, such as Correos Express, SEUR and UPS, from its
consumer site and from Packlink PRO for businesses, in Spain and other European markets. Its
reference names the booking; the carrier that collects the parcel gives it its own number.

## Numbers

A Packlink reference is 19 characters: two letters for the market, the four-digit year, `COM`
for the consumer site or `PRO` for Packlink PRO, and ten digits. Packlink's help centre and its
open-source shop modules print that layout, and no other carrier's rule takes it, so the rule
has high confidence. The samples and their sources are in [`numbers.json`](numbers.json).

## Links

The search box on Packlink's tracking pages takes the reference or the carrier's number. No
address that opens one shipment is known, so no portal link is published.

## Limitations

- Universal providers name Packlink for the reference. The carrier's own number, which
  Packlink's tracker also takes, is detected on its own.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
