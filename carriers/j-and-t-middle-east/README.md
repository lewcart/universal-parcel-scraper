# J&T Express Middle East

J&T Express Middle East parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

J&T Express Middle East runs one network, site and tracker for Saudi Arabia, the United Arab
Emirates and Kuwait, apart from the other J&T operations. Its tracking form accepts a waybill
only as `JTE` followed by twelve digits, and its tracker answers such numbers for all three
countries. `j-and-t-middle-east-1` claims that shape.

## Links

The tracker opens one or more waybills at `www.jtexpress.me/<country>/trajectoryList` from
`waybillNo`, where the country is `KSA`, `UAE` or `KW`; `www.jtexpress.ae` serves the same site.

## Limitations

The tracker looks a waybill up through
`POST ofmg.jtjms-sa.com/official/logisticsTracking/v2/getDetailByWaybillNo`. It takes a
captcha ticket, and a placeholder ticket while J&T's captcha switch is off. Times come in the
zone the request names. A dedicated adapter is a lead, not yet written.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
