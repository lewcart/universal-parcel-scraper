# SPX Express Indonesia

SPX Express Indonesia parcels use enabled universal providers. There is no dedicated adapter.

SPX Express Indonesia is Shopee's delivery network in Indonesia. It runs its own tracker and
numbers; `spx-ph` and `spx-br` cover the Philippine and Brazilian networks, whose numbers carry
their own country codes.

## Numbers

Marketplace parcels carry SPXID followed by eleven digits and a final digit or letter. The
tracker pairs each with an SLS number, ID followed by twelve digits and, on newer parcels, a
final digit or letter, and looks up either. The SPXID prefix names this network, so its rule
has high confidence. The low-confidence rule suggests SPX Express Indonesia for the SLS layout,
whose ID prefix alone does not rule out other senders.

## Links

`spx.co.id/track?{number}`, with the number as the whole query string, is the address the
tracker's search builds, under `/m` on phones, and archived lookups use. Older lookups open
`spx.co.id/detail/{number}`.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
