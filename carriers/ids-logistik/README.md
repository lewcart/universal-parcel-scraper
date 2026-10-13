# IDS Logistik

IDS Logistik parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

IDS is a German general-cargo network whose regional partners collect and deliver. Its
tracking form takes a Sendungsnummer of 13 to 16 characters together with the recipient's
postcode. A Trustpilot review and an archived lookup on IDS's own tracking service show
sixteen-digit numbers. Sixteen digits are shared by several carriers, so no rule claims them.

## Links

The form sends `trackingNumber` and the recipient's postcode as `zipCode` to
`ids-logistik.de/de/sendungsverfolgung`; the page shows nothing without the postcode, so no
address opens one parcel from the number alone. Only the number is read from such links.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
