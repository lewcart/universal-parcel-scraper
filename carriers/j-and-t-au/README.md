# J&T Express Australia

J&T Express Australia parcels use enabled universal providers. There is no dedicated adapter.

J&T Express Australia runs its own network, site and tracker, apart from the Southeast Asian J&T
operations in `j-and-t`.

## Numbers

Its waybills are `JTAU` and twelve digits, `JT` and the country code, and its tracker answers
for them. The shape is fixed and no other carrier's rule takes it, so `j-and-t-au-1` has high
confidence. No public number has been found, so the corpus holds a synthetic one.

## Links

The [tracker](https://www.jtexpress.au/tracking) looks a parcel up when the number is in its `q`
parameter.

## Retrieval

The tracker posts the numbers to
`official.jtaunz.com/official/logisticsTracking/getDetailByWaybillNo?countryCode=AU`. The
request is signed with an MD5 of the app id, timestamp, nonce, body and key the site ships to
every visitor; no phone digits, CAPTCHA or account are needed. Each scan has a local time
without an offset and a customer wording, with no status code or place. An unknown number
comes back as an empty list.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
