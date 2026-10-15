# SPX Express Malaysia

SPX Express Malaysia parcels use enabled universal providers. There is no dedicated adapter.

SPX Express Malaysia is Shopee's delivery network in Malaysia. It runs its own tracker and
numbers; `spx-ph` and `spx-br` cover the Philippine and Brazilian networks, whose numbers carry
their own country codes.

## Numbers

Marketplace parcels carry SPXMY followed by eleven digits and a final digit or letter. The
tracker pairs each with an SLS number, MY followed by twelve digits and a final digit or
letter. The SPXMY prefix names this network, so its rule has high confidence. The
low-confidence rule suggests SPX Express Malaysia for the SLS layout, whose MY prefix alone
does not rule out other senders.

## Links

`spx.com.my/track?{number}`, with the number as the whole query string, is the address the
tracker's search builds, under `/m` on phones, and archived lookups use. Older lookups open
`spx.com.my/detail/{number}`. The site's search markup names
`spx.com.my/en/tracking?tracking_no={number}` as its search address.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
