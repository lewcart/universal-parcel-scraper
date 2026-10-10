# OSM Worldwide

OSM Worldwide parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Most lookups archived from OSM Worldwide's tracker are 22-digit USPS Intelligent Mail package
barcodes starting `92`: OSM hands most parcels to USPS for the last mile, so these are USPS's
numbers. The USPS rules claim them, and those starting `9261` stay a suggestion shared with DHL
eCommerce. OSM's own layout is `A`, ten digits, a three-letter hub code and eight digits; it
was seen from 2019 to 2024 and `osm-worldwide-1` claims it. Two other layouts, three letters,
`IPA` and eight digits (2021) and five letters and 25 digits (2020), were seen too rarely to
claim.

## Links

OSM Worldwide's tracker at `www.osmworldwide.com/tracking/` reads comma-separated numbers from
`trackingIds`, which its own search writes, and from the older `trackingNumbers`. The library
reads the number from either, and `www.osmworldwide.com/tracking/?trackingIds={number}` opens
one parcel.

## Testing

Provider live-test inputs and commands are in the [provider READMEs](../../providers/README.md).
