# Posta (Faroe Islands)

Posta parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Posta's customs help says postal items carry UPU S10 numbers, some postal items 20-digit
numbers, and DHL freight ten-digit waybills. Lookups archived from Posta's trackers carry
inbound items under their sending posts' S10 numbers, with histories that follow them through
customs in Tórshavn to delivery. Generic postal detection handles S10 numbers, so no Posta
rule claims them. DHL's waybills stay with DHL, and no public 20-digit number is known.

## Links

The tracker is a single-page app that reads the number from the last path segment, so
`posta.fo/en/private/send-receive/track-trace/{number}` opens one parcel; the Faroese and
Danish pages use `fo` and `da`. The former site took the number as `cc` on `posta.fo/search`.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
