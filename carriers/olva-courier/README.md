# Olva Courier

Olva Courier parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Olva's tracking number pairs a serial with the two-digit year it was issued. Its help pages
print it as eight digits, a hyphen and the year, and its tracker's example puts the year first,
a hyphen and seven digits. No rule claims these: detection compares numbers with spaces and
hyphens stripped, and they are then plain digit runs other carriers print too. The tracker's
example of an AliExpress shipment is `ALI-OLVA` and eight digits; `olva-courier-3` claims it,
written with or without the hyphen. The tracker also takes credit customers' service orders and
other carriers' numbers for shipments Olva delivers.

## Links

The tracker's search form sends the number as `q` to `tracking.olvacourier.com`, so that
address with `?q=` opens one shipment.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
