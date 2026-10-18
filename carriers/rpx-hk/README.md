# RPX Online

RPX Online parcels use enabled universal providers. There is no dedicated adapter.

RPX is the eCommerce parcel arm of Hong Kong's Lenton Group, which also runs DPD Hong Kong.
Its tracker at tracking.rpxonline.com is the Lenton tracker app that DPD Hong Kong and Hub-ez
share, and it is RPX's own lookup, separate from DPD's network. Its former tracker page on
rpxonline.com showed parcels from RPX's London depot through the flight and customs to
delivery by its own drivers in Hong Kong.

## Numbers

The archived lookups on RPX's former tracker page show `HKGL` and ten digits, the first two
of them the year, on parcels from London to Hong Kong. `rpx-hk-1` claims that layout; no
other carrier prints it. The current tracker takes up to 40 numbers at once and also searches
customer references; no lookup of it is archived, so other layouts it may answer are unknown.

## Links

`tracking.rpxonline.com/?trackNo={number}` opens the tracker and looks the number up: its
script reads `trackNo`, and `trackingNumber` too. The former tracker page took the number in
the path, `rpxonline.com/component/track/{number}`; that page is gone.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
