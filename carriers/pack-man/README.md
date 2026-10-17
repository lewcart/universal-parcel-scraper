# Pack-Man

Pack-Man parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Pack-Man is a courier for the Attica basin. Its search page asks for the code from its SMS or
receipt and gives an example voucher of a letter, a hyphen and eight digits; a lookup archived
from its former voucher search shows a real one in that layout. Without the hyphen, a letter
and eight digits is also the shape of other carriers' numbers, so no rule claims it.

## Links

The search page is a GET form that sends the code as `code`, so
`pack-man.gr/anazitisi-apostolis.html?code={number}` opens one parcel. The former voucher
search on `courier.pack-man.gr` read the number from `r18p01`; archived lookups use that
address.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
