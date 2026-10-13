# TForce Freight

TForce Freight shipments use enabled universal providers. There is no dedicated adapter.

## Numbers

TForce Freight, formerly UPS Freight, tracks LTL shipments by nine-digit PRO numbers, as its
tracking API manual states. Lookups archived from its tracker and from the former UPS Freight
tracker give samples. Nine digits are shared by many carriers, so no rule claims them. The
tracker also searches by bill of lading or purchase order, which are not tracking numbers.

## Links

The tracker reads one PRO number or several from `?proNumbers=` on
`tforcefreight.com/ltl/apps/Tracking`. The former UPS Freight tracker read `?TrackProNumber=`
on `ltl.upsfreight.com/shipping/tracking/TrackingDetail.aspx`.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
