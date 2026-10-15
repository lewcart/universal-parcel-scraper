# AyMakan

AyMakan parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

AyMakan tracking numbers are `AY` followed by digits. Its tracker, its API documentation and
its PHP SDK show nine, ten and eleven digits after the prefix, and `aymakan-1` claims them.
Older shipments carry a bare six-digit number, which archived lookups on the tracker, the API
documentation and the SDK show. No rule claims six digits: many carriers print short digit
runs.

## Links

AyMakan's tracking form sends one number, or several separated by commas, to
`aymakan.com/tracking/{number}`, which opens the shipment. Archived lookups use the former
`aymakan.com.sa/en/tracking/{number}` and `aymakan.com.sa/ar/tracking/{number}` addresses.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
