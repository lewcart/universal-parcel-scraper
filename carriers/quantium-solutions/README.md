# Quantium Solutions

Quantium Solutions parcels use enabled universal providers. There is no dedicated adapter.

Quantium Solutions is a Singapore e-commerce logistics company with cross-border, warehousing
and last-mile services in Asia Pacific.

## Numbers

Archived lookups on Quantium's tracker show ten-digit tracking numbers for Malaysian shipments
and UQ, nine digits and TH for Thai ones. The Thai layout has the UPU S10 shape without a valid
S10 check digit. The tracker also finds shipments by Quantium reference numbers such as UQM-MU
or UQT-TU and eight digits. No rule claims these: ten digits are printed by many carriers, S10
shapes are left to postal detection, and universal providers track the tracking number rather
than the reference.

## Links

`track.quantiumworldwide.com/?trackno={number}` opens one parcel: the tracker reads `trackno`
and loads its result from `itapps.quantiumworldwide.com` with `as_order_no`. The former tracker
`track.quantiumsolutions.com` used the same `trackno` parameter.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
