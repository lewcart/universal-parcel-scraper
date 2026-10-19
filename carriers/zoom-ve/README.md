# Zoom

Zoom parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Zoom guías are ten digits. Archived lookups on its own trackers show them, and the former
tracker labelled the field "Nro. Guía ZOOM". Ten digits are printed by many carriers, so no
rule claims them.

## Links

`zoom.red/tracking-de-envios-personas/` reads the guía from `?nro-guia=` with
`tipo-consulta=1`, then asks for a Turnstile check before it shows the history. The former
tracker on `grupozoom.com` read it from `?txtcodguias=` on `/mia/consultar.php`.

## Why there is no adapter

The tracker's server verifies the Turnstile token before it renders a history, so a request
without one gets no history. Zoom's integration API tracks a guía only for the merchant
account that created it, and the Zoom apps that once tracked parcels are no longer
published, so Zoom stays on universal providers.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
