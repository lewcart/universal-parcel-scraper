# eParcel Korea

eParcel Korea parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

eParcel Korea (용성종합물류) flies e-commerce parcels from Korea to other Asian countries and hands
them to a delivery company there, such as Ninja Van in the Philippines or Janio in Thailand.
Its tracker takes a registration number made of E, the destination country code, nine digits
and KR, and archived lookups show that layout. The `eparcel-kr-1` rule claims it.

The tracker also takes order numbers and the courier numbers of the departure and destination
countries. Those belong to the shipper or to the other carriers, so no rule here claims them.

## Links

The tracker's search page opens `www.eparcel.kr/Track/Result?mode=0&ids={number}&lang=en-US`
for registration numbers, and archived lookups use that address. The lookup on the home page
opens `www.eparcel.kr/Track/MainTracking?num={number}`.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
