# Correo Uruguayo

Correo Uruguayo parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Correo Uruguayo's tracker asks for the full thirteen-character code: two letters, nine digits
and two letters, the UPU S10 layout. Domestic items carry it too and end in UY, as archived
lookups show; inbound items keep the origin post's number, and the post assigns a new one
when an inbound purchase arrives without a valid code. Generic postal detection handles the
layout, so Correo Uruguayo adds no rule of its own.

## Links

The tracking page reads `codigoPieza` and looks the item up at once, so
`ahiva.correo.com.uy/servicioConsultaTntIps-web/SeguimientoJSNuevo?codigoPieza={number}` opens
one item. Several codes can be given, separated by commas. The page on `correo.com.uy` embeds
it.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
