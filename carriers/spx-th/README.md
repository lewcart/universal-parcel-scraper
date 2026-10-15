# SPX Express Thailand

SPX Express Thailand parcels use enabled universal providers. There is no dedicated adapter.

SPX Express Thailand is Shopee's delivery network in Thailand. It runs its own tracker and
numbers; `spx-ph` and `spx-br` cover the Philippine and Brazilian networks, whose numbers carry
their own country codes.

## Numbers

Marketplace parcels carry SPXTH followed by eleven digits and a final digit or letter. The
tracker pairs each with an SLS number, TH followed by twelve digits and usually a final digit
or letter, and looks up either. The SPXTH prefix names this network, so its rule has high
confidence. The low-confidence rule suggests SPX Express Thailand for the SLS layout, whose TH
prefix alone does not rule out other senders. Flash Express numbers also start with TH but mix
letters into the middle, so the two rules do not overlap.

## Links

`spx.co.th/track?{number}`, with the number as the whole query string, is the address the
tracker's search builds, under `/m` on phones, and archived lookups use.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
