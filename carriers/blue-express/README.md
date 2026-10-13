# Blue Express

Blue Express parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Blue Express tracks a shipment by its service order number (orden de servicio, OS), ten digits
in archived lookups. Ten bare digits are printed by many carriers and nothing in the number
points to Blue Express, so no rule claims them.

## Links

The tracking page `blue.cl/enviar/seguimiento?n_seguimiento=` followed by the number opens a
shipment. Older pages on `blue.cl`, `bluex.cl` and `tracking-unificado.blue.cl` take the same
parameter, and the first tracker used `tracking.bluex.cl/lctracking.asp?id=`.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
