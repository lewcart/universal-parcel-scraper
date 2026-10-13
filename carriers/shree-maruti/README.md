# Shree Maruti Courier

Shree Maruti Courier parcels use enabled universal providers. There is no dedicated adapter.

Shree Maruti Courier Services is a domestic courier and parcel network in India.

## Numbers

The tracker asks for an AWB number. Customers and archived lookups show bare digit runs: twelve
and thirteen digits on the former tracker, and fourteen digits on recent dockets, which begin
with the two digits of the booking year. Digit runs of these lengths are printed by many other
carriers, so no rule claims them.

## Links

The home page's tracking box opens `shreemaruti.com/track-shipment/?awb={number}`, which loads
the tracker at `tracking.shreemaruti.com/{number}` in a frame. The tracker also reads the
number from its `d` and `shipmentNo` parameters, as archived lookups on
`shreemaruti.com/tracking/` and `clients.shreemaruti.com/tracking/` show. The former tracker
took it as `tracking_id` on `shreemaruticourier.com/track-your-shipment/` and later on
`shreemaruti.com`.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
