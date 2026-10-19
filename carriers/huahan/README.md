# HuaHan Logistics

Tracks HuaHan's own waybills through its public guest tracker. HuaHan carries parcels from
China to destination delivery partners.

## Retrieval

The [public form](https://www.hh-exp.cn/WebTrack/CargoTrack.html) opens verification through
`init.php`, reads a plain arithmetic question from `textcode.php`, and submits its answer to
`check.php`. After an explicit acceptance, the adapter posts one complete waybill to
`CargoTrackActiona.php` in the same cookie session. Each lookup opens a fresh session and
shares one deadline across the four requests. No account, browser or external solver is needed.

The reply must repeat the requested waybill and confirm success. An explicit absence is
not found; verification failures, changed replies and an empty history remain distinct.
The adapter keeps the server's scan order, milestone codes, wording and locations. Clocks
have no offsets, including scans from destination partners, so they remain local times.
Shipper references and partner identifiers are omitted.

## Numbers

HuaHan waybills are `HHW`, two letters, ten digits and `YQ`. Its API documentation describes
that layout, which detection and the adapter accept. Postal and partner references are
outside this adapter's scope.

## Limitations

There is no cheap recognition flow: tracking requires a fresh verification exchange. Changed
challenge types remain a challenge and enabled universal providers can recover. Provider
history can supplement scans whose clocks cannot be placed on a timeline.

The customer API at `api.hh-exp.com/default/svc/web-service` needs account credentials;
it is separate from the anonymous web form.

## Testing

Set `HUAHAN_TRACKING_NUMBER` outside Git and run
`npm run test:carriers:live -- carriers/huahan`. `HUAHAN_UNKNOWN_NUMBER` checks explicit absence.
