# Speedex

Speedex parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Speedex vouchers are twelve digits. Lookups archived from Speedex's tracker show them starting
`01`, `04`, `05` and `70`. Twelve digits are shared with several carriers,
Courier Center among them, so no rule claims them. The tracker also answers DHL parcel numbers
that Speedex delivers in Greece; those stay with DHL.

## Links

Speedex's search form sends the number as `voucher_code` to `www.speedex.gr/isapohi.asp`, which
frames `www.speedex.gr/speedex/NewTrackAndTrace.aspx?number={number}` with the history. Both
addresses open one parcel.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
