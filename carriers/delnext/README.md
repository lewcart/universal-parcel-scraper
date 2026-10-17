# Delnext

Delnext parcels use enabled universal providers. There is no dedicated adapter.

Delnext is a Portuguese courier that collects in mainland Portugal and Spain and delivers
there and across the EU, handing international parcels to partner networks. Its tracker
shows Delnext's own scans and, after a failed delivery, the partner and the partner's
tracking number.

## Numbers

Delnext's tracking code is six capital letters and digits, the layout of every archived
lookup on its tracker and of complaints on Portal da Queixa. Two complaints quote seven
characters. No rule claims either: short letter-and-digit codes are shared with other
carriers' references and point to no carrier.

## Links

The tracker form sends the code as `tracking_code` to `/<language>/track_your_parcel` on
`www.delnext.com`, so `www.delnext.com/PT/track_your_parcel?tracking_code={number}` opens
one parcel. Archived lookups also put the code in the path, after `tracking_code/`. The
tracker asks for the recipient's postcode or phone only before changing a delivery.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
