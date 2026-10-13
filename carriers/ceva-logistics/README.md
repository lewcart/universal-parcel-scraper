# CEVA Logistics

CEVA Logistics shipments use enabled universal providers. There is no dedicated adapter.

CEVA Logistics is the freight and contract logistics arm of the CMA CGM group. Its tracker,
CEVA Trak, searches house and master bills, customer order numbers and other references; CEVA
Home Delivery has its own tracking page.

## Numbers

CEVA's references take many forms: eight to ten digits, digits with a suffix after a hyphen,
and a few letters followed by digits. None of them points to CEVA alone, so no rule claims
them.

## Links

CEVA Trak reads a reference from `reference_query` on its page, such as
`cevalogistics.com/en/ceva-trak`. CEVA Home Delivery's page reads it from `trackingID`, and the
older freight tracker on `etracking.cevalogistics.com` from `sv`.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
