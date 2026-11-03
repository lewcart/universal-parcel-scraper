# Matson

Matson shipments use enabled universal providers. There is no dedicated adapter.

Matson, based in Honolulu, carries containers, vehicles and freight by sea between the US mainland,
Hawaii, Alaska, Guam and the Pacific islands, and from China. Its site is matson.com.

## Numbers

Matson tracks containers by their ISO 6346 numbers and shipments by its booking numbers. It
publishes no booking number format, and no public page shows one of its numbers, so there is no
rule.

## Why there is no adapter

None is built yet. Its shipment tracking page posts the number with a choice of container or
booking number, with no page or address per number. The lookup needs no account or CAPTCHA: the
page's script posts `container_trackingnumber`, `trackingVal` (`containerNumber` or
`bookingNumber`) and the `ttr` value the page's form carries to
`/wp-content/plugins/matson-plugin/Api_calls/tracking_booking_proxy.php`, which answers JSON with
the container's number, check digit, booking number and `events`. The page has their dates
converted by another request, `Api_calls/timezonerange.php`, so how a date's clock is read needs a
captured reply. Vehicles have a page of their own, `/auto-tracking.html`, which posts to
`Api_calls/webtrack_proxy.php`.

## Links

No tracking link is known.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
