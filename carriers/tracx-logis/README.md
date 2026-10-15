# TracX Logis

TracX Logis parcels use enabled universal providers. There is no dedicated adapter.

TracX Logis is the new name of Qxpress, a cross-border delivery company that ships between
Korea, Japan, Singapore, Hong Kong and Taiwan and delivers Qoo10 orders. Older labels and
emails still say Qxpress.

## Numbers

Qxpress's tracker shows its own numbers as QSP and nine digits. The high-confidence rule claims
that layout; Purolator's three-letter rule excludes the QSP prefix. Lookups for JP and seven
digits stay unclaimed, since no archived reply shows their history. Twelve-digit numbers that
pass the Japanese mod 7 check and thirteen digits starting with 6 also reach this tracker; they
match the Japanese domestic carriers and Korea Post that take over the last mile, so they are
quarantined.

## Links

`tracxlogis.com/tracking` opens one parcel from its `trackingNo` parameter. Old
`qxpress.net/Customer/PopupTraceParcels` links carry the number in `TrackingNo`.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
