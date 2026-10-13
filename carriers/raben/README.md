# Raben

Raben parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Raben's tracking box asks for the shipment number. Lookups archived from its myRaben shipment
page show fifteen-digit numbers. Fifteen-digit runs are printed by several parcel carriers, so
no rule claims them.

## Links

The tracking box on Raben's site sends the number as `ShipmentNumber` to
`/link/ShipmentInformation` on `oftc.myraben.com`, which opens one shipment without an account.
Archived lookups and shop integrations use the same path on `myraben.com`.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
