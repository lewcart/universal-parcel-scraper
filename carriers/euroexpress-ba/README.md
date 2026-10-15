# EuroExpress

EuroExpress parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

EuroExpress calls its tracking number the shipment code; it is printed on the waybill. The
manual of EuroExpress's own web shop shows a nine-digit code. Many carriers print nine digits,
so no rule claims it.

## Links

The tracker reads the code from the last part of its address,
`euroexpress.ba/pracenje-posiljke/{number}`, as its page script shows.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
