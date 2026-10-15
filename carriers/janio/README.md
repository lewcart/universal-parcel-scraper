# Janio

Janio parcels use enabled universal providers. There is no dedicated adapter.

Janio is a Singapore cross-border e-commerce logistics company that ships parcels into and
within Southeast Asia.

## Numbers

Janio's tracker shows JN, two letters such as CN or TH and twelve digits, for example on
AliExpress parcels delivered in Singapore, which Cainiao also tracks. The low-confidence rule
suggests Janio for that layout and sits next to AliExpress's rule for the JNCN form. Older
lookups show order-based numbers with a merchant or service prefix and a destination country
suffix; no rule claims those, since each prefix has too few samples to tell its issuer.

## Links

`tracker.janio.asia/{number}` opens one parcel: the tracker reads the number from the first
path segment.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
