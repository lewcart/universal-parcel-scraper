# Kunyoung Express

Kunyoung Express parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Kunyoung Express (건영택배) prints ten-digit waybill numbers; its waybill lookup asks for ten
digits without hyphens. Many Korean carriers print the same digit runs, so no rule claims them.

## Links

`mj.kunyoung.com/?invoiceNumber={number}` fills the tracking field and runs the lookup. The
waybill lookup on `kunyoung.com/goods/goods_01.php` reads `mulno` and lists the parcel, and
`goods_02.php` with the same parameter shows its history.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
