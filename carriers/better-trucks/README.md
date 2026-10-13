# Better Trucks

Better Trucks parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

A complaint about a Better Trucks delivery gives a fifteen-character number starting `BTPA`,
and another complaint prints the same prefix with masked characters. `better-trucks-1` suggests
Better Trucks for `BTPA` and eleven letters or digits, at low confidence because only one
complete number has been seen. Shippo's integration guide shows a `BTS_` number, which stays in
quarantine until a public shipment confirms that form. The tracker also accepts five-character
package codes, which no rule claims.

## Links

The tracker opens one parcel at `tracking.bettertrucks.com/tracking?trackingNumber={number}`.
The carrier's site links the same page with the number in `ShipmentId`. The library reads the
number from either parameter.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
