# Amerijet

Amerijet parcels use enabled universal providers. There is no dedicated adapter.

Amerijet International is an all-cargo airline based in Miami that flies to the Caribbean
and Latin America.

## Numbers

Amerijet tracks a shipment by its air waybill: the airline prefix 810, then eight digits. Its
own booking instructions print one with a dash after the prefix. Rule `amerijet-1` claims that
dashed form, which no other carrier prints. The same eleven digits without the dash are shared
by several carriers, so the rule leaves them unclaimed.

## Links

The tracker takes the prefix and the eight digits in two fields and looks them up from its
script. No address opens one shipment.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
