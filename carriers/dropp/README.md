# Dropp

Dropp parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

A Dropp shipment is tracked by the barcode on its package, letters and digits only. Dropp
generates one when the merchant does not send its own order id, and its API documentation gives
no fixed layout, so no rule claims Dropp numbers.

## Links

`api.dropp.is/dropp/track/{number}` opens one shipment: the search on dropp.is links each
result there, and an archived lookup on Dropp's host uses that address.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
