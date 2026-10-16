# Bussgods

Bussgods parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Bussgods fraktsedel numbers seen on its tracker are `BG` followed by ten digits starting with
9, and ten bare digits. `bussgods-1` suggests the `BG9` layout at low confidence, because
Amazon Logistics' rule claims every `BG` and ten digits at high confidence. Ten bare digits are
shared by many carriers and stay unclaimed.

## Links

The site's search widget opens `bussgods.se/spara-paket/#{number}`, and the tracking page
reads the number from the fragment. The former tracker opened one parcel at
`bussgods.se/sok-paket/{number}`, with `/foretag/` in front for business customers.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
