# SkyPostal

SkyPostal parcels use enabled universal providers. There is no dedicated adapter.

SkyPostal carries cross-border e-commerce parcels from its Miami hub to Latin America and hands
them to a carrier in the destination country, keeping its own number on its tracker.

## Numbers

Archived lookups on SkyPostal's tracker show two layouts. `SKAMZUS` and ten digits is claimed
by `skypostal-1`; Colis Privé's low rule also accepts some of these seventeen-character
numbers. `SP`, eleven digits and `BR` is suggested by `skypostal-2` at low confidence, because
it is seen only on older Brazil shipments. The tracker also follows Correios international
numbers for Brazil parcels; generic postal detection handles those.

## Links

The home page's tracking box opens `tracking.skypostal.com/?trck_number={number}&lng_code=ENG`.
Older lookups used `tracking.skypostal.com/single-tracking.aspx?trck_number={number}`. The
library reads the number from both.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
