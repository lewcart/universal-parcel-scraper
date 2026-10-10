# Venipak

Venipak parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Venipak parcel numbers are `V`, five digits, `E` and seven digits: Venipak's own shop modules
build them from the sender's customer ID and a running serial. Lookups archived from Venipak's
tracker show them from 2015 on, sometimes typed in lower case, and `venipak-1` claims them. The
tracker also answered eight-digit numbers, sometimes typed with a leading zero; eight digits
are shared with several carriers, so no rule claims them and the user picks Venipak.

## Links

Venipak's tracking form opens one parcel at `venipak.com/lt/en/tracking/track/{number}`; the
Lithuanian and Estonian pages use `/lt/tracking/track/` and `/ee/tracking/track/`, and
Venipak's shop modules link `venipak.com/tracking/track/{number}`. Archived lookups on the
former `www.venipak.lt` used `/siuntos-kelias/track/` and `/en/tracking-information/track/`.

## Testing

Provider live-test inputs and commands are in the [provider READMEs](../../providers/README.md).
