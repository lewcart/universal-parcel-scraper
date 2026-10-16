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
most networks outside the United States and Canada: Cloudflare answers HTTP 403 with its block
page, even to the tracker in a browser, which then reports the delivery as not found. Roadie's Android app is its drivers' app and
needs a driver's account, so Roadie stays on universal providers.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
