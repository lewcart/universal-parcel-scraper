# Algérie Poste

Algérie Poste parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Algérie Poste's international letters, parcels and EMS items carry UPU S10 numbers ending in
`DZ`, which generic postal detection handles. Its express subsidiary, EMS Champion Post
Algérie, also gives domestic express items `EC` or `ED` and eleven digits, as its tracking
form's examples show. `algerie-poste-1` suggests Algérie Poste for that layout with low
confidence; La Poste's broad rule for two characters and eleven digits matches it too.

## Links

The EMS Champion Post Algérie tracker reads a number from `icd` on `ems.dz/track/index.php`,
so one item opens at `ems.dz/track/index.php?icd={number}`. It shows Algérie Poste's parcel
network events as well as EMS ones. An earlier version read `icd` on `track.ems.dz/track.php`.
Algérie Poste's own site did not answer.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
