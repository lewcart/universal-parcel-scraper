# Zajil Express

Zajil Express parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Zajil shipment numbers are eleven or twelve digits; older references start with `Z`. Detection
does not claim them: the digit runs are shared by many carriers, and the `Z` references have
too few public lookups to define a layout.

## Links

The tracker opens one shipment from `zajil-express.com/track?tracking_id={number}`, also under
`/ar/`; the library reads the number from both.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
