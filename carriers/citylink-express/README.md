# City-Link Express

City-Link Express parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

City-Link consignment numbers are fifteen digits; the tracker's field asks for fifteen.
Lookups archived from City-Link's tracker and forum posts show them starting `0603` and, more
recently, `9603`. No rule claims them: detection compares numbers with spaces and hyphens
stripped, and fifteen digits are then a plain digit run other carriers print too.

## Links

City-Link's tracking form opens `citylinkexpress.com/tracking-result/?track0={number}`,
numbering further consignments `track1` onwards.
Older lookups used `cno` on `ShipmentTracking_Details.aspx`. The library reads the number from
both.

The current public script posts `tracking` and `xr_option: false` to
`/wp-json/wp/v2/getTracking`, without a CAPTCHA token. Network and User-Agent filtering can
still return a Cloudflare refusal. Its result uses `req.data`, with `trackingNo` and
`trackDetails`; an explicit HTTP 404 JSON error says there is no tracking data. A direct
adapter still needs a current, identity-matching history to establish the response contract.
Proof-of-delivery verification is a separate flow requiring contact details.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
