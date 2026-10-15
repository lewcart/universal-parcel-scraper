# Yalidine

Yalidine parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Yalidine tracking numbers are `yal-` and six letters or digits. Its tracking form takes exactly
ten characters with that placeholder, and the examples in Yalidine's API documentation and an
open-source client follow it. `yalidine-1` claims the layout, read without the dash: no other
carrier prints the prefix.

## Links

The tracking form posts the number after a Cloudflare Turnstile check, so no address opens one
parcel.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
