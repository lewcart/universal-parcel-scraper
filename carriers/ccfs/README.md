# CrossCountry Freight Solutions

CrossCountry Freight Solutions parcels use enabled universal providers. There is no dedicated
adapter.

CrossCountry Freight Solutions (CCFS) is a less-than-truckload carrier based in Bismarck, North
Dakota, serving the northern and western United States. Its tracker looks up a pro number, a
freight bill number or a shipper's reference and shows the status and the scan history.

## Numbers

An archived reply of CCFS's own tracking API shows a twelve-digit pro number and a freight bill
number of one letter and seven digits for the same shipment. Both shapes are shared with other
carriers, so no rule claims them and gap declarations cover them. Sister brands on the same
platform have their own numbers and are outside this entry.

## Links

`auth.ccfs.com/track/detail/{number}` opens one shipment: the home page's tracking script
builds it and an archived lookup uses it.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
