# Egypt Post

Egypt Post parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

International items carry UPU S10 numbers ending `EG`, which generic postal detection offers.
Domestic items carry three letters, eight digits and `EG`; the tracker's own script shows the
`ENO`, `EXP` and `RCC` prefixes, and an archived lookup shows an Express item. `egypt-post-1`
suggests Egypt Post for those three prefixes at low confidence, since few samples back them. A
longer placeholder in the script, with nine digits, is not claimed.

## Links

The tracking field on `egyptpost.gov.eg` hands the numbers to its Track and Trace page through
the browser's storage, so no address opens one parcel there. The earlier tracker on
`egyptpost.org`, which now redirects to the new site, read them from `itemReference` on
`/track-details`.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
