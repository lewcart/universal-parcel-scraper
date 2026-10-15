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

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
