# 4-72

4-72 parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

4-72, Servicios Postales Nacionales, is Colombia's national post. Its guías are UPU S10
numbers with the `CO` suffix, and it also tracks inbound S10 items from other posts. Generic
postal detection handles S10 numbers, so 4-72 has no rule of its own.

## Links

`svc2.sipost.co/TrazabilidadWeb` reads the guía from `?guia=`, and 4-72's own tracker builds
that address. `ReportTrace` on the same host opens the delivery certificate, and
`enviosonline.4-72.com.co` reads the guía from `?guia=` on `rastrear.php`.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
