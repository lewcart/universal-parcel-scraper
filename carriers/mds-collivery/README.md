# MDS Collivery

MDS Collivery parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Collivery tracks by waybill number. The waybills in its API documentation are seven digits. No
rule claims them: seven digits are a bare digit run many carriers share.

## Links

Collivery's integration guide shares one waybill as `collivery.net/tracking?waybill={number}`,
and its tracking page loads that waybill's history. The former tracker took the number as
`waybillNo` on `quote.collivery.co.za/tracking.php`.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
