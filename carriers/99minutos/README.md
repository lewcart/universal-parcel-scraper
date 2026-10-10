# 99minutos

99minutos parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

99minutos's tracker asks for the guía number. Lookups archived from it show numeric tracking
IDs: nine digits in 2020 and 2021, ten digits from late 2021 to 2025. Its help page also
describes lettered layouts starting `99MEX` or `MX`, but none was seen in a lookup. Nine and
ten digits are shared with TNT, DHL and several other carriers, so no rule claims them and the
user picks 99minutos.

## Links

The search form checks the number, then opens `tracking.99minutos.com/search/{number}`, which
shows one parcel; the library reads the number from such a link and builds it. Older lookups
used the same path on `www.rastreo.99minutos.com` and `beta.tracking.99minutos.com`, and in
2021 `99minutos.com/tracking/{number}`; the library reads those too.

## Testing

Provider live-test inputs and commands are in the [provider READMEs](../../providers/README.md).
