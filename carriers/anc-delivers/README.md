# ANC Australian National Couriers

ANC parcels use enabled universal providers. There is no dedicated adapter.

ANC (Australian National Couriers), the trading name of Fleets Flyers Pty. Limited, founded in 1921
and part of the Taylor Group since 1961, delivers big and bulky goods to homes for retailers in
Australia. Its site is ancdelivers.com.au.

## Numbers

Its numbers are A, eight digits and two letters; its help pages say to look for the number starting
with A. Three archived lookups on its tracker show that shape, all from one kind of source, so
`anc-delivers-1` suggests ANC at low confidence.

## Why there is no adapter

The tracker asks an open JSON service with the number alone, without a login or CAPTCHA, and tells
an unknown number from a booking it no longer keeps. Its replies also carry the recipient's contact
details and address, which an adapter would leave out. An adapter can follow.

## Links

Tracking links carry the number in the path after `/track/`.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
