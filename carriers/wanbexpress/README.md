# WanbExpress

WanbExpress parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

WanbExpress's own parcel numbers are `WNB`, two letters, ten digits and `YQ`; its tracker
reports them as its parcel ids. Its tracker also finds a parcel by the delivery carrier's number
or the shipper's reference. A twenty-digit sample on an aggregator page matches DHL's label shape.

## Links

`tracking.wanbexpress.com/?trackingNumbers={number}` puts the number in the search box, but the
lookup waits for a reCAPTCHA, so no link opens one parcel.

## Why there is no adapter

The tracker at `tracking.wanbexpress.com`, where the English site's search form leads, reads
`GET /TrackPoints/Track?TrackingNumber=`. Its JSON holds the parcel's status, origin and
destination countries, the delivery service and the delivery carrier's number, and scans in UTC
with each scan's zone offset; an unknown number answers `Match: "Unknown"` without scans. The
server answers error `0x110012` (the human check failed) until `/Home/CaptchaVerify` has accepted
a reCAPTCHA token for the visitor's ASP.NET session; a session it accepted then serves further
lookups over plain HTTP. The page asks for a reCAPTCHA v2 checkbox. It still publishes a v3 site
key and `showCaptchaVersion` V3, and the server also accepts the v3 token the former page fetched
without interaction, but only a browser can get one.

`www.wanbexpress.com` and the customer portal `client.wanbexpress.com` answer HTTP clients and
fresh browsers with an Alibaba Cloud ESA slider. The documented developer API
(`api.wanbexpress.com/api/trackPoints`) needs a customer's account token and answers 403 without
one. WanbExpress has no app on Google Play.

## Testing

Provider live-test inputs and commands are in the [provider READMEs](../../providers/README.md).
