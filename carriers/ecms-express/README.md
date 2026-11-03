# ECMS Express

The guest tracker returns parcel history and relayed last-mile scans through
`POST /brige/getTarcking` on `www.ecmsglobal.com`. Each request needs a fresh,
single-use sign: open `/brige/math/captcha/get/base64`, solve the arithmetic PNG,
then submit its answer to `/brige/math/captcha/check`.

The adapter uses the shared local OCR model with ECMS's image geometry and a
digit/plus/minus alphabet. It requires the optional `sharp` and `onnxruntime-web`
dependencies. One fresh challenge can recover an unreadable or rejected answer,
within the caller's budget. Repeated refusal stays a challenge, allowing enabled
universal providers to handle the miss. No browser, account or saved sign is needed.

The response must repeat the complete ECMS identifier in its shipment summary
and every scan. The parser keeps the full event sequence, status codes, locations
and a named delivery partner. A partner reference is retained only from that
partner's relayed scans when they agree. Merchant references and payment links
are discarded.

`operatorTime` with a nonzero `timeZone` encodes a facility wall clock as UTC components,
and the offset stays exactly as supplied, including fixed standard offsets in summer. ECMS
writes its own scans' wall clocks from their instant with the station's offset, so read at
that offset they land on the second the API records them, also where the offset is not the
place's civil one. A `timeZone` of zero marks the relayed partners' scans, SpeedX's and
MICOM's, whose `operatorTime` is the instant: SpeedX's own copies state the same second with
the place's offset, and read on the place's clock the scan would fall after ECMS recorded it.
Those scans carry the instant alone. The API's ingestion clock is not a scan timestamp.

The US tracking page, `/en-us/tracking.html`, opens a parcel from `?number=`; the other
locales' pages still read `?orderNumber=`. Links in either form, and the former trackers'
links, name ECMS.

The former consignee and OMS trackers no longer supply guest history. The ESE
customer event API requires login, and freight tracking uses different references.

Run the live tests with `ECMS_EXPRESS_TRACKING_NUMBER` and optionally
`ECMS_EXPRESS_UNKNOWN_NUMBER` from an environment file outside the repository:

```sh
npm run test:carriers:live -- carriers/ecms-express/adapter.live.test.ts
```
