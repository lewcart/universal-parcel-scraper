# WooliiPorter

WooliiPorter shipments use enabled universal providers. There is no dedicated adapter.

WooliiPorter forwards parcels bought in China, such as Taobao, 1688 and JD orders, from its
Chinese warehouse to buyers abroad, and fulfils orders for merchants. It gives each shipment one
public number for every leg and merges its partners' scans under it. Its site is woolii.com.

## Numbers

The tracking page takes `WP` and thirteen digits, the last a Luhn check digit of the twelve before
it, and checks the digit before it asks. It also takes `WPTRK-` references. The page's own example
is the only public number, so the rule offering WooliiPorter for `WP` and thirteen digits is low.
It does not check the digit: the catalog's Luhn check reads digits only.

## Why there is no adapter

None is built yet. The tracking page asks `GET https://woolii.com/api/public/tracking/{number}`
for JSON, with no cookie, token or CAPTCHA, and answers an unknown number with HTTP 404 and
`{"error":"Tracking not found"}`. No public number shows how it answers a shipment.

## Links

A woolii.com link to `/track/<number>` names WooliiPorter, and the page tracks the number it
holds. A link holding several numbers is not read.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
