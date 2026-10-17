# GLS Austria

GLS Austria parcels use enabled universal providers. There is no dedicated adapter.

GLS Austria is the GLS group's network in Austria. Its tracker is the group's tracking page
under `gls-group.com/AT/`, which asks the group's tracking service for Austrian parcels, apart
from the German, Polish and other country pages that the other `gls-*` entries read.

## Numbers

Parcels carry the GLS group's eleven-digit parcel number, printed on labels with a twelfth
check digit, and an eight-character Track ID. Archived replies of GLS Austria's tracking
service show parcels GLS Austria takes in and delivers, Austrian parcels delivered in Germany,
and parcels from other GLS networks delivered in Austria. Every GLS network issues the same
layouts, and the GLS Germany, Switzerland and France entries already suggest them with low
rules, so no rule claims them for GLS Austria and detection does not offer it.

## Links

The tracking page `gls-group.com/AT/de/paket-verfolgen/` reads the number from `match`, so
`?match={number}` opens one parcel. Links on `gls-group.com` or `gls-group.eu` under `/AT/` are
read for GLS Austria.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
