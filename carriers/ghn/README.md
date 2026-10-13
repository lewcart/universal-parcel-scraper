# GHN

Giao Hàng Nhanh (GHN) parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

GHN order codes, which GHN's API calls its tracking code, are eight letters and digits;
lookups archived from GHN's tracker show them starting `G`, and a few older ones nine or ten
characters. Eight-character codes are also GLS's layout, so no rule claims them.

## Links

GHN's site opens its tracker as `donhang.ghn.vn/?order_code={number}`, and the library reads
the number from that address.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
