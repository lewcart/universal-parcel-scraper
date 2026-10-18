# Quicksilver

Quicksilver parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Quicksilver is a Saudi courier that delivers across the kingdom. Its tracker numbers are the
letters `QS` and nine digits; an archived lookup on its tracker shows one through to delivery.
`quicksilver-sa-1` suggests the layout with low confidence, because one public number backs it
and GLS Italy's low rule covers any two letters and nine digits.

## Links

The tracker opens one parcel at `erp.quick-silver.express/v2/tracking/{number}`. The tracking
page on `quick-silver.express/Tracking` reads the number from `tracking_number` and looks it up
on load.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
