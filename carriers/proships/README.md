# ProShips

ProShips parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

ProShips is a Bogotá e-commerce logistics company that delivers cross-border parcels in
Colombia, among them MailAmericas parcels from AliExpress orders. Customer complaints and a
printed tracking page name ProShips with the numbers those parcels carry from their senders:
S10 numbers, MailAmericas numbers and a SHEIN parcel's number.

No rule claims ProShips numbers. S10 numbers belong to the issuing network, MailAmericas'
rule claims MailAmericas numbers, and no number shape of ProShips' own is known.

## Links

One parcel opens on proships.com under `/tracking` with the number in the `tracking`
parameter, the address the tracking form builds. An older form sent the number in the `code`
parameter. The library reads the number from either parameter.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
