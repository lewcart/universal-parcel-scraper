# Roadie

Roadie deliveries use enabled universal providers. There is no dedicated adapter.

## Numbers

Roadie's tracker takes the delivery id from Roadie's notification links. Lookups archived from
the tracker show two layouts, which its script treats apart: `1R` and 26 letters and digits,
sent in capitals, and `1R` and 14 hexadecimal digits, sent in lower case. `roadie-1` and
`roadie-2` claim them.

## Links

The tracker opens one delivery at `track.roadie.com/id/{number}`. It redirects
`/track/{number}` and `/track?tracking_number=` there, also behind a partner theme prefix.

## Why there is no adapter

The tracker reads a delivery from `GET api.roadie.com/gigs/{number}/track`, with no key or
sign-in. The delivery's ZIP code only unlocks the address, photos and driver. That API refuses
requests outside the United States, as the [official API FAQ](https://docs.roadie.com/)
explains. The block also reaches the browser tracker, whose error screen calls any lookup
failure a missing delivery. A browser or CAPTCHA solver alone cannot fix this network gate.

The [Roadie Driver Android app](https://play.google.com/store/apps/details?id=com.roadie.drive.android.app)
is signed by the certificate published in [Roadie's app links](https://drive.roadie.com/.well-known/assetlinks.json).
Its REST client uses the same `api.roadie.com` host; its `drive-server.roadie.com/graphql`
client serves signed-in driver work. No separate guest tracking route was found there.
A direct adapter needs a successful guest lookup from US egress and a same-shape missing-number
control before its response parser can be verified. The ZIP-gated recipient details are not
needed for parcel status.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
