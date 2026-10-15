# SPX Express Vietnam

SPX Express Vietnam parcels use enabled universal providers. There is no dedicated adapter.

SPX Express Vietnam is Shopee's delivery network in Vietnam. It runs its own tracker and
numbers; `spx-ph` and `spx-br` cover the Philippine and Brazilian networks, whose numbers carry
their own country codes.

## Numbers

Marketplace parcels carry SPXVN followed by eleven digits and a final digit or letter. The
tracker pairs each with an SLS number, VN followed by twelve digits and a final digit or
letter. The SPXVN prefix names this network, so its rule has high confidence. The
low-confidence rule suggests SPX Express Vietnam for the SLS layout, whose VN prefix alone does
not rule out other senders.

## Links

`spx.vn/track?{number}`, with the number as the whole query string, is the address the
tracker's search builds, under `/m` on phones, and archived lookups use.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
