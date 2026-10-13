# Coordinadora

Coordinadora parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Coordinadora tracks a shipment by its guide number (número de guía), which its tracker accepts
as eleven digits. Eleven bare digits are printed by many carriers and nothing in the number
points to Coordinadora, so no rule claims them.

## Links

The tracker `rastreo.coordinadora.com/?guia=` followed by the number opens a shipment. Older
pages on `coordinadora.com` and `rastreos.coordinadora.com` take the guide as a parameter or
as the last path part.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
