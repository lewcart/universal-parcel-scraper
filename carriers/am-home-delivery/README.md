# AM Home Delivery

AM Home Delivery parcels use enabled universal providers. There is no dedicated adapter.

AM Home Delivery is a New York based two-person home delivery carrier for furniture, mattresses
and appliances. Its tracking page looks up one number and shows the current status, the
delivery estimate and the scan history.

## Numbers

The tracking field takes digits only. Archived lookups on the carrier's own pages show
seven-digit PRO numbers on the older Carrier Logistics tracker and eight-digit track numbers on
the current page, which also lists the shipper's bill of lading number. Bare digit runs of
these lengths are other carriers' numbers too, so no rule claims them and gap declarations
cover both layouts.

## Links

`amtrucking.com/track-number.php?cnumber={number}` opens one shipment: the carrier's tracking
form builds it and archived lookups use it. Older lookups on
`tracking.carrierlogistics.com/scripts/amh.pol/boldetail.htm` carry the PRO number in `wpro1`.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
