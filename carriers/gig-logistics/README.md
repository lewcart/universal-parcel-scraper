# GIG Logistics

GIG Logistics parcels use enabled universal providers. There is no dedicated adapter.

GIG Logistics (GIGL) is a Nigerian courier with service centres across the country.

## Numbers

Its waybills have ten digits. The examples in GIG's API documentation start with 1, but GIG
does not document the layout, and ten digits are shared with many carriers, so no rule claims
it. The tracker also takes an "Alphacode", whose layout is not documented.

## Links

`giglogistics.com/track-shipment/?waybill={number}` opens the tracking page with the waybill.

## Why there is no adapter

None has been written yet. The tracking page calls a public JSON service by the waybill, with
no session or CAPTCHA. Its scan times carry no offset, and its replies hold addresses and the
names of the scanning staff and the receiver, which an adapter must not read.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
