# Flight Logistics

Flight Logistics parcels use enabled universal providers. There is no dedicated adapter.

Flight Logistics (Flight Logistics Group Ltd) is a third-party logistics provider at Heathrow and
Wokingham in the United Kingdom, with eCommerce fulfilment, courier and freight services and art
shipping. Its site is flightlg.com.

## Numbers

Flight Logistics publishes no number format, and no public page shows one of its airway bill or
job numbers, so there is no rule.

## Why there is no adapter

Its tracker runs on Courier Navigator, as [UBX UK's](../ubx-uk/README.md),
[World Package's](../world-package/README.md) and Hart2Hart Express's do. The MyFlight page posts
the airway bill or job number as `consign_note` to
`flightlg.couriernavigator-secure.com/json/search/trackingdownload`, an open JSONP endpoint without
a session or CAPTCHA, which answers an unknown number with an empty `jobs` list. The page's script
reads a found job's events (time stamp, description and status id) and addresses. No public number
is known to see a found reply.

## Links

The MyFlight page opens numbers from its `consign_note` parameter, with `method=tracking`. The
Courier Navigator host's own tracking page does not read the parameter.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
