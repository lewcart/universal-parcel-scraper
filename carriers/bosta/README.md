# Bosta

Bosta parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Bosta shipment numbers are plain digit runs: seven and eight digits in archived lookups on its
tracker and in the sample numbers of Bosta's front-end assessment. Its tracking API also
answers for shorter draft orders, which are not shipments. No rule claims these numbers:
seven or eight digits are a shape many carriers print.

## Links

Bosta's tracking page opens one shipment from `shipment-number`, with or without the locale
in the path: `bosta.co/en-eg/tracking-shipments?shipment-number={number}`. Its script builds
that address from the navigation bar's search. The former page,
`bosta.co/tracking-shipment/`, took the number as `track_num`.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
