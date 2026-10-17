# SGH Global Japan

SGH Global Japan parcels use enabled universal providers. There is no dedicated adapter.

SGH Global Japan, formerly Sagawa Global Express, is SG Holdings' international arm. Its SGX
tracker covers international courier shipments into Japan from the group's stations abroad,
which Sagawa Express delivers after customs.

## Numbers

SGX air waybills have twelve digits with the Sagawa Express check digit, and the tracker gives
the same number as the Sagawa Express domestic waybill. The sagawa rule already offers Sagawa
Express for that shape, so no rule claims it for SGX. Air waybills from Los Angeles can instead
start with IDA and twelve digits; the IDexpress rule leaves that layout alone, and no rule
claims it because one waybill shows it. The nine-digit references with a hyphenated suffix that
shippers give belong to the tracker's REF# search, not to an air waybill.

## Links

`tracking.sagawa-sgx.com/sgx/trackeng.asp?ENC=JPN&CAT=AWB&AWB={number}` opens one air waybill,
as the tracking form on SGH Global Japan's support page builds it. Links that set `CAT` to a
reference or account search carry other identifiers in the same parameter.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
