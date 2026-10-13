# Starken

Starken parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Starken tracks a shipment by its order of freight number (orden de flete, OF), nine digits in
the tracking field's example and in archived lookups. Nine bare digits are printed by many
carriers and nothing in the number points to Starken, so no rule claims them.

## Links

Starken's own pages send a shipment to `starken.cl/seguimiento?codigo=` followed by the number,
which opens it. The older site used `starken.cl/seguimiento/` followed by the number.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
