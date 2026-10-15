# GS Postbox

GS Postbox parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

GS Postbox is GS Networks' parcel service at GS25 convenience stores, formerly CVSnet. Its
own store-to-store service, 반값택배, prints twelve-digit numbers; archived lookups on its
tracker show them starting `210` with scans from GS Networks' own centres. SMSA Express and
other carriers print twelve-digit numbers in the same range, so no rule claims them. Home
delivery booked at a GS25 store, 국내택배, travels as a CJ Logistics waybill: the tracker
names CJ대한통운 as its carrier, and those numbers stay with CJ Logistics.

## Links

The tracking page on `cvsnet.co.kr/reservation-inquiry/delivery/` opens
`cvsnet.co.kr/invoice/tracking.do?invoice_no={number}`, which shows one parcel. The tracking
page also reads `invoice_no` and opens that address at once.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
