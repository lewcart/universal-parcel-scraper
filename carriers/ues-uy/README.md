# UES

UES parcels use enabled universal providers. There is no dedicated adapter.

UES is a Uruguayan courier for e-commerce parcels, cards and mail, with home delivery and a
network of Pick Up and Xpres collection points.

## Numbers

UES's help pages say its tracking numbers start with UES or UESM. Customers quote both: UESM
followed by nine digits, and UES followed by thirteen digits. Rule `ues-uy-1` claims these two
layouts with high confidence, since the prefix is the carrier's own name and no other carrier
uses it.

## Links

The tracker page reads the number from its `criterioId` parameter, fills the field and runs
the lookup. The lookup needs a reCAPTCHA answer, so a visitor may have to solve it before the
history appears. The page's `cr` parameter only fills the field.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
