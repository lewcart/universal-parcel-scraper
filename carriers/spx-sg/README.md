# SPX Express Singapore

SPX Express Singapore parcels use enabled universal providers. There is no dedicated adapter.

SPX Express Singapore is Shopee's delivery network in Singapore. It delivers Shopee orders
from local sellers, who drop parcels at its points or have them collected, and from overseas
sellers through Shopee's sorting centres abroad. `spx-my`, `spx-th` and the other `spx-*`
entries cover Shopee's networks in other countries.

## Numbers

Parcels carry SPXSG followed by eleven digits and a final character, a digit in the archived
lookups and a digit or letter at the sister networks; `spx-sg-1` claims them. The tracker pairs
a parcel with its Shopee SLS number, SG followed by twelve digits and a final digit or letter.
`spx-sg-2` suggests SPX Express Singapore for that layout with low confidence, since the SG
prefix alone does not rule out other senders.

## Links

`spx.sg/track?{number}`, with the number as the whole query string, is the address the
tracker's search builds, under `/m` on phones, and archived lookups use it. Older lookups open
`spx.sg/detail/{number}`.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
