# DPEX Worldwide

DPEX Worldwide parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

DPEX Worldwide is an express and e-commerce network across Asia. Its air waybills are twelve
digits whose last digit is the first eleven modulo 7, as archived lookups on its tracking page
show. No rule claims them: Yamato, Sagawa and Japan Post print twelve-digit numbers with the
same check digit.

## Links

The dpex.com track-and-trace page opens air waybills from its `cn` query parameter, several
separated by commas; the former `/Tools-And-Applications/Track-And-Trace` address redirects
there with the same parameter. The page's search button and the DPEX China system open the
`/trace-and-track/index` page with the numbers in `id`.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
