# Cruz del Sur

Cruz del Sur parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Cruz del Sur tracks a shipment by its NIC, the internal control number printed on each label
and consignment note. Its own help illustrations print it as seven digits, a hyphen and two
digits; the tracker field takes up to ten characters. Short digit groups like these are not
unique to Cruz del Sur, so no rule claims them.

## Links

The tracker posts the NIC from `herramientas_seguimiento.php` behind a reCAPTCHA check, so no
address opens one shipment.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
