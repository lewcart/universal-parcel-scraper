# Mylerz

Mylerz parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Mylerz barcodes are fourteen digits starting `63`. Its tracker's script reads exactly that
shape as a barcode and sends anything else to its reference search. Archived lookups on the
tracker and its tracking API show the same shape. `mylerz-1` suggests Mylerz for it with low
confidence: fourteen-digit numbers are also printed by the DPD networks and other carriers. The
tracker's field also accepts `MYLE` and nine digits, a layout no public number shows, so no
rule claims it.

## Links

The tracker opens one barcode from `mylerz.net/track/{number}`, the address its own search
navigates to. Archived links put the barcode in the path of `mylerz.net/trackShipment/` and
`mylerz.net/track-details/`; the library reads the number from all three.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
