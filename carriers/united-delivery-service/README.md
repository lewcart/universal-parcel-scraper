# United Delivery Service

United Delivery Service parcels use enabled universal providers. There is no dedicated adapter.

United Delivery Service (UDS) is a regional courier for same-day, next-day and routed
deliveries in Illinois, Indiana and Wisconsin, sorted at its Chicago-area hubs.

## Numbers

The tracker takes the package barcode, which is often the shipper's own. UDS's own labels
carry two digits, `UDS` and eleven digits, or `APUDS` and eight digits;
`united-delivery-service-1` claims those layouts, which no other carrier uses. Other packages
keep the shipper's barcode: eleven, twelve or eighteen digits, `EZ` numbers from a shipping
platform, or references such as `BBC`, `DY` or `C` followed by digits. They name the shipper
or platform rather than UDS, or share their shape with many carriers, so no rule claims them.

## Links

Tracker pages are `uniteddeliveryservice.com/track/barcode/{number}`; the library reads the
number from that address.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
