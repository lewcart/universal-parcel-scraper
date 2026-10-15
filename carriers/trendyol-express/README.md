# Trendyol Express

Trendyol Express parcels use enabled universal providers. There is no dedicated adapter.

## Limitations

Trendyol's cargo tracker reads a public JSON lookup, but Cloudflare refuses that lookup to
clients other than a browser. The Trendyol app tracks only a signed-in customer's orders.

## Numbers

Customers quote sixteen-digit shipment numbers starting `7330` or `10`, which Trendyol and
Dolap show next to the separate order number. Sixteen digits are shared with DHL eCommerce and
others, so no rule claims them. Trendyol order numbers, ten or eleven digits, and Dolap order
codes starting `SP` are not tracking numbers.

## Links

Archived lookups on Trendyol's cargo tracker pass the shipment number as `orderNumber`, so
`kargotakip.trendyol.com/?orderNumber={number}` opens one parcel. The search field on the
Trendyol Express home page opens the same tracker with an opaque key instead.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
