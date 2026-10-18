# Guatex

Guatex parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Guatex guías seen in public have eleven characters: a letter, three or four digits, one or two
letters and five digits. An integrator's guide shows two in a sample Guatex reply, each with
child guías for further pieces, and a customer quoted one on Guatex's Facebook page. Three
samples in two variants are too few for a rule, so no rule claims them.

## Links

Guatex's site opens its tracker at `servicios.guatex.gt/Guatex/RastreoTracking` with `tipo=G`
and the guía in `dato`. The tracker page also takes a guía typed into its own field.
It looks the guía up with a POST of `noguia` to `servicios.guatex.gt/Guatex/Login/ObtengoTrackingGuia`,
which needs no login. An unknown guía answers code 204, "El número de guía no existe". No found
reply has been seen, so there is no adapter yet.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
