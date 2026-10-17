# Correos de El Salvador

Correos de El Salvador parcels use enabled universal providers. There is no dedicated adapter.

The Dirección General de Correos runs the national post of El Salvador.

## Numbers

Its items carry UPU S10 numbers ending in SV. Inbound items keep the S10 number of the post
that sent them. Generic postal detection handles both, so no carrier rule claims the layout.

## Links

The tracker page at correos.gob.sv sends the number from its form to the post's tracking API
and draws the history itself, so no address opens one parcel. The former tracker took the
number in the path of a `/rastrear-paquete/` address; the library reads a number from that
address, which now redirects to the tracker page.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
