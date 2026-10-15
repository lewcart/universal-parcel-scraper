# SPX Express Brazil

SPX Express Brazil parcels use enabled universal providers. There is no dedicated adapter.

SPX Express Brazil is Shopee's delivery network in Brazil. It runs its own tracker and numbers;
`spx-ph` covers the Philippine network, whose numbers carry a PH prefix.

## Numbers

Archived lookups on the tracker show BR followed by thirteen characters: twelve digits and a
final digit or letter. The low-confidence rule suggests SPX Express Brazil for that layout; the
BR prefix alone does not rule out other senders.

## Links

`spx.com.br/track?{number}`, with the number as the whole query string, is the address archived
lookups use, as on the Philippine tracker. After a search the tracker script moves to
`spx.com.br/detail/{number}`.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
