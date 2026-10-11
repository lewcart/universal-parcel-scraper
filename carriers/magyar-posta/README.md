# Magyar Posta

Magyar Posta items use enabled universal providers. There is no dedicated adapter.

## Numbers

An aggregator page prints an MPL business-parcel number, `PB` and eleven digits; one sample
does not establish a rule. International items use the UPU S10 layout and stay with the generic
postal carrier.

## Links

Magyar Posta's tracker posts the item numbers behind a reCAPTCHA, so no link opens one
parcel.

## Why there is no adapter

The tracker page at `www.posta.hu/nyomkovetes/nyitooldal` frames a search form under
`/ikrnyomkovproxy/`. The form posts the numbers with the answer to a reCAPTCHA checkbox, and the
server refuses a search without a valid answer.

The Posta app (`hu.posta.uzletimobil`) reads tracking from a guest API under
`net.posta.hu/mpl/public/api/mobile/guest`. An anonymous request issues the install an
application id, and every request carries a key the app ships. Adding a number posts it with an
invisible reCAPTCHA Enterprise token, and the server refuses the request without a valid one.
The app refreshes the numbers it has added without a token, but a number reaches that list only
through the checked request.

The previous app's `PostaWeb/TrackingInfo` read is now refused by the site's firewall, and its
copy on `postamobil.eu` no longer answers. The MPL tracking API on `core.api.posta.hu` needs a
business client id. Every route that looks up a new number is behind a reCAPTCHA or an
account, so Magyar Posta stays on universal providers.

## Testing

Provider live-test inputs and commands are in the [provider READMEs](../../providers/README.md).
