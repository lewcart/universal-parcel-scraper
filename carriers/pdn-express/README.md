# PDN Express

PDN Express parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

PDN Express B.V. delivers parcels for online shops and marketplaces, such as AliExpress orders
and Amazon sellers, to addresses in the Netherlands with its own couriers. Its tracking numbers
are PDN followed by ten digits. The tracking form shows one as its placeholder, archived
lookups on the tracker hold others, and customers and PDN's replies quote them on Trustpilot
and klacht.nl.

`pdn-express-1` claims PDN and ten digits with high confidence because no other carrier prints
that prefix. Magyar Posta's low-confidence domestic rule takes any P, a letter, three
characters and eight digits, so a PDN number whose last digit happens to fit its check digit
also suggests Magyar Posta; the PDN rule decides.

## Links

One parcel opens on pdn.express under the language folder, `/en/track/`, `/nl/track/`,
`/de/track/` or `/fr/track/`, followed by the number. The tracker's copy-link button builds
that address, and older lookups on tracking.pdn.express used the same path, so the library
reads the number from both hosts.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
