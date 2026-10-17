# CORRE

CORRE parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

CORRE, Correio Expresso de Moçambique, is Mozambique's designated postal operator and took
over the universal postal service from Correios de Moçambique. Its EMS and postal items carry
UPU S10 numbers ending in `MZ`. Generic postal detection handles these numbers, so no rule for
CORRE claims them.

## Links

The national lookup on corremz.com opens one item at `/cgi-bin/tracktrace.cgi` with the number
in the `OBJ` parameter, and the search page's form sends the same parameter to
`/cgi-bin/trace.cgi`. International items are looked up on the UPU Global Track and Trace,
which has no address for one item.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
