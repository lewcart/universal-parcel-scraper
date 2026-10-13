# Transportes Castores

Transportes Castores parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

A carta porte carries two references. The talón is the 11 digits under its barcode, and the
tracking form accepts exactly 11 characters. The guía, printed at the top right, is three
capital letters, a hyphen and digits. Castores' tracking manual gives an example of each, and
archived lookups on its own tracker show talones with their histories. No rule claims
either: eleven digits are a bare counter other carriers share, and the guía shape has a single
documentation example.

## Links

The search form on `castores.com.mx` opens `rastrear.html` with the talón in `?guide_numbers=`.
Archived lookups also show older trackers that took it in `/rastreo/?talon=`, in the
`/rastreo/` path and on `tomcat2.castores.com.mx`.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
