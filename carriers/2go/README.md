# 2GO Express

2GO Express parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

2GO numbers are a capital letter, seven digits and a capital letter, the CN and document
numbers of its eTrace tracker that customers still receive. A low-confidence rule suggests 2GO
for that shape. 2GO Express also tracks references made of AA and seven digits; that shape has
no rule.

## Links

The library reads a number from the `tracking_no` query parameter of `/tracking` on
`express.2go.com.ph`, the older tracking page, which now forwards visitors to the 2GO Express
site. The current tracker encodes the number in Base64 inside its `/status/` path, so the
library reads no number from it.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
