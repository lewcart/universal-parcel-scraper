# Alliance Air Freight

Alliance Air Freight shipments use enabled universal providers. There is no dedicated adapter.

Alliance Air Freight, based in Los Angeles, forwards truck, rail, ocean and air freight across the
US and abroad. Its site is shipalliance.com.

## Numbers

Alliance publishes no housebill or shipment number format, and no public page shows one of its
numbers, so there is no rule.

## Why there is no adapter

None is built yet. Its quick track page, on a CargoWise shipment portal, posts the number through
an ASP.NET form with the page's view state, with no page or address per number. It needs no
account or CAPTCHA. The form's `ddlTrackBy` names the kind of number: waybill (`HousebillNo`),
bill-to, shipper or consignee reference, CTR, origin house bill, master air waybill or master
ocean bill. No public number shows the page it answers with.

## Links

No tracking link is known.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
