# Ward Transport & Logistics

Ward freight shipments use enabled universal providers. There is no dedicated adapter.

## Numbers

Ward PRO numbers are a three-digit terminal and seven digits, printed with a dash. Its tracker
also takes them as eleven digits without the dash, as an archived lookup shows. Both shapes
are shared with other carriers, so no rule claims them. The tracer also searches by bill of
lading with the origin postal code, which is not a tracking number.

## Links

Ward's tracker reads a PRO number from `?pro=` on
`wardtlctools.com/wardtrucking/traceshipment/create`.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
