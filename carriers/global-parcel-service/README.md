# Global Parcel Service

Global Parcel Service parcels use enabled universal providers. There is no dedicated adapter.

Global Parcel Service (GPS), based in Los Angeles, ships e-commerce parcels from China to the
United States, clears them through customs and hands them to USPS for the last mile. Its site is
www.goforgps.com.

## Numbers

Its tracker's example is a USPS barcode: the 420 routing code and a ZIP code before the USPS
number. Detection names USPS for it, so there is no rule.

## Why there is no adapter

Its parcels carry USPS numbers, which the [USPS adapter](../usps/README.md) tracks. The site's
tracker posts the numbers, up to 25 joined by commas, as JSON `{"tracking_no": …}` to
`/api/gfg/shipment-tracking/trace` on www.goforgps.com, with no key or session. Its answer lists
one record per number, with a summary and rows that each give a description, a place, a clock and
its zone. A number the tracker does not know, and its own example, both get an empty list, which
the site's page shows as an error rather than as not found, so the tracker cannot tell an unknown
number from one it no longer holds. The apex goforgps.com fails TLS; the tracker answers on www.

## Links

Tracking links carry the numbers as `search` on the `tracking` page of www.goforgps.com.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
