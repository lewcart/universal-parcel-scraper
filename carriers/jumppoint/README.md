# Jumppoint

Jumppoint parcels use enabled universal providers. There is no dedicated adapter.

Jumppoint is a Hong Kong parcel delivery company with its own couriers and a network of pick-up
points. Its international parcels track on a separate site.

## Numbers

Jumppoint waybills are `JP` and twelve digits, the layout its tracker accepts. SHOPLINE's
Jumppoint help shows one on a sample printout. `jumppoint-1` claims the layout.

## Links

The [tracker](https://tracking.jumppoint.io/) opens one parcel when the number is in its `q`
parameter.

## Retrieval

The tracker sends the number with a fresh reCAPTCHA v3 token to
`tracking-api.jumppoint.io/shipment/tracking/`, so there is no plain HTTP route.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
