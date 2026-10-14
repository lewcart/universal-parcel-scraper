# Skroutz Last Mile

Skroutz Last Mile parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Skroutz Last Mile calls its tracking number a voucher: thirteen capital letters and digits. An
archived lookup on Skroutz's own tracking page shows one. The shape is shared with UPU numbers
and several carriers' codes and has no prefix or check digit, so no rule claims it. The
contact form also accepts partner carriers' numbers, which stay with those carriers.

## Links

Skroutz Last Mile's tracking page reads the voucher from the address fragment, so
`skroutzlastmile.gr/#{number}` opens one parcel. Skroutz's shipment page,
`skroutz.gr/track/{number}`, shows the same history; the library reads the voucher from it.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
