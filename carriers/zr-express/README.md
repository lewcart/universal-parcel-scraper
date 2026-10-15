# ZR Express

ZR Express parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

ZR Express tracking numbers are three blocks joined by dashes: two characters, six, seven or
ten letters and digits, and two characters. The tracker's script accepts that layout, its
search field gives a ten-character middle block as the example, and open-source clients of ZR's
API show six and ten. Every number seen starts with two digits and ends with `ZR`, which is
what `zr-express-1` claims, as printed with its dashes; no other carrier uses that layout.

## Links

The tracker's search form opens one parcel at `zrexpress.net/suivi?tn={number}`, and at
`/en/track` and `/ar/suivi` in English and Arabic. `zrexpress.dz` and `zrexpress.app` redirect
to `zrexpress.net`.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
