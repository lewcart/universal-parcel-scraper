# GLS Poland

GLS Poland parcels use enabled universal providers. There is no dedicated adapter.

GLS Poland is the GLS group's network in Poland. Its tracker is the group's tracking page under
`gls-group.com/PL/`, which asks the group's tracking service for Polish parcels, apart from the
German, Italian and other country pages that the other `gls-*` entries read.

## Numbers

Parcels carry the GLS group's eleven-digit parcel number, printed on labels with a twelfth
check digit. Archived replies of GLS Poland's tracking service show both forms. Every GLS
network issues the same layout, and the GLS Germany, Switzerland and France entries already
suggest it with low rules, so no rule claims it for GLS Poland and detection does not offer it.

## Links

The tracking page `gls-group.com/PL/pl/sledzenie-paczek/` reads the number from `match`, so
`?match={number}` opens one parcel; the English page under `/PL/en/parcel-tracking/` does the
same. Links on `gls-group.com` or `gls-group.eu` under `/PL/` are read for GLS Poland.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
