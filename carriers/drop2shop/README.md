# Drop2Shop

Drop2Shop parcels use enabled universal providers. There is no dedicated adapter.

Drop2Shop is COLL-8 Logistics' service through Irish convenience stores, where shoppers
collect online orders and drop off returns. COLL-8 clears inbound parcels through Irish
customs and hands them to a partner for the last mile; in the captured histories that was DPD
Ireland, whose reference the tracker shows beside its own number.

## Numbers

Drop2Shop numbers are GLB and thirteen digits; archived lookups on its tracking API show them
in upper and lower case. No other carrier's numbers or rules use that shape, but GLB does not
name the carrier, so the rule only suggests Drop2Shop. The partner's reference belongs to that
carrier, such as dpd-ie.

## Links

`drop2shop.ie/tracking` with `trackingnumber` opens one parcel, on the main host and on the
`coll8` host. Return confirmations link to the same page with `trackingNumber`.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
