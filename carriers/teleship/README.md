# Teleship

Teleship parcels use enabled universal providers. There is no dedicated adapter.

Teleship is a UK delivered-duty-paid shipping service for Shopify and WooCommerce merchants.
Royal Mail carries the first mile to Teleship's hub near Heathrow, line haul runs to Belgium
or by air to the US and other markets, and a local carrier delivers. Teleship's tracking page
shows the whole journey and names that last-mile carrier and its local number once the parcel
reaches the destination country.

## Numbers

Teleship's own tracking IDs start with `TS`, followed by the origin and destination country
codes in its example. Its FAQ and its home page give different lengths, so no rule claims
them. On Teleship's DHL service the DHL waybill is the tracking number, which DHL's rules
already cover.

## Links

The tracking page at `teleship.com/tracking` reads the number from `number` or
`trackingNumber`, so `teleship.com/tracking?number={number}` opens one parcel.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
