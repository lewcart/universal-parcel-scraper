# Yalidine

Yalidine parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Yalidine tracking numbers are `yal-` and six letters or digits. Its tracking form takes exactly
ten characters with that placeholder, and the examples in Yalidine's API documentation and an
open-source client follow it. `yalidine-1` claims the layout, read without the dash: no other
carrier prints the prefix.

## Links

The tracking page fills its field from `yalidine.com/suivre-un-colis/?tracking={number}`, but it
shows a history only after a Cloudflare Turnstile check, so no address opens one parcel.

## Limitations

Yalidine's server verifies the Turnstile token before it looks the number up; without one it
answers the same retry message for every number. The merchant dashboard and the developer API
need a Yalidine account, and Yalidine publishes no tracking app, so Yalidine stays on universal
providers.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
