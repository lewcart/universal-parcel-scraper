# Correo Argentino

Correo Argentino parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Registered letters, parcels and international items carry a UPU S10 number ending `AR`, such
as the domestic `CU`, `CP` and `EE` services and outbound `RR` letters. The tracker's forms
take the two-letter service, the nine digits and the country separately. Lookups archived
from Correo Argentino's former tracker show them, domestic and outbound alike. Generic postal
detection handles S10 numbers, as for other posts without a dedicated adapter, so no Correo
Argentino rule claims them. Inbound items keep the number of the post that sent them.

The tracker also has forms for e-commerce parcels and for Mercado Libre shipments, which take
other layouts. No public number of those was found, so no rule claims them.

## Links

The current forms send the number in a background request, so no address opens one parcel.
The former tracker took a whole inbound number in the path of
`correoargentino.com.ar/seguimiento_envios/consultar/oidn/`; only that number is read from it.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
