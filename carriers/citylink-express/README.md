# City-Link Express

City-Link Express parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

City-Link consignment numbers are fifteen digits; the tracker's field asks for fifteen.
Lookups archived from City-Link's tracker and forum posts show them starting `0603` and, more
recently, `9603`. No rule claims them: detection compares numbers with spaces and hyphens
stripped, and fifteen digits are then a plain digit run other carriers print too.

## Links

City-Link's tracking form opens `citylinkexpress.com/tracking-result/?track0={number}`,
numbering further consignments `track1` onwards; the page loads the details behind a reCAPTCHA.
Older lookups used `cno` on `ShipmentTracking_Details.aspx`. The library reads the number from
both.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
