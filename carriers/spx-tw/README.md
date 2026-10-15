# SPX Express Taiwan

SPX Express Taiwan parcels use enabled universal providers. There is no dedicated adapter.

SPX Express Taiwan runs Shopee's store-to-store service (蝦皮店到店) in Taiwan, where parcels wait
at a pickup store. Its tracker and numbers are separate from the other SPX networks, such as
`spx-ph` and `spx-br`.

## Numbers

Archived lookups on the tracker show TW followed by twelve digits and a final letter, the
layout of other SPX networks' SLS numbers, which can also end in a digit. The low-confidence
rule suggests SPX Express Taiwan for TW, twelve digits and a final digit or letter; the TW
prefix alone does not rule out other senders.

## Links

Archived lookups open `spx.tw/detail/{number}`, which the link rule reads. The current site
sends that path to its not-found page when no number follows, so no parcel address is given.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
