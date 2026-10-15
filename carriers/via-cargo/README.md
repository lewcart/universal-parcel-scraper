# Via Cargo

Via Cargo parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Via Cargo shipment numbers seen on its own trackers are twelve digits starting with `999`.
Other carriers in the corpus print twelve-digit numbers with the same start, so no rule claims
them.

## Links

`formularios.viacargo.com.ar/seguimiento-envio/<number>` opens one shipment: the tracker reads
the number from its path and searches it after a reCAPTCHA check. Older trackers on
`viacargo.com.ar` carried it in `/tracking/<number>` and `/api/tracking/<number>/`.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
