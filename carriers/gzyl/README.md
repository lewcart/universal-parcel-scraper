# GZYL

Tracks shipments of GZYL (广州云链货运代理有限公司), a Guangzhou forwarder, on its own tenant of
the Hualei (华磊) forwarder platform. [Tianhui Hengyuan](../thhy/README.md),
[JRT](../jrt/README.md) and [Meiteshun Logistics](../mtscn/README.md) run tenants of the same
platform; they share the client in [hualei.ts](hualei.ts) and keep their own hosts and status
maps.

## How it works

1. `direct`: one GET to `selectTrack.htm?documentCode=<number>` on the tracker at
   `134.175.243.207:8082`, the platform's documented track interface. It answers JSON encoded in
   GBK, with one record per order and its rows. When it says it holds no row (`未查询到轨迹`),
   the adapter posts the same number as the `documentCode` field to `trackIndex.htm`, the
   tracking page the tenant's site opens. The page answers an unknown number with an empty
   waybill that only echoes the number, which is the only not-found. It also shows the
   platform's own row for an order without scans, which some tenants' interfaces leave out.
2. `retry`: the same read once more after a request fails to reach the tracker or hangs. The
   first attempt gets half of the budget.

No account, key, cookie, CAPTCHA or browser is needed. The trackers answer plain HTTP only, on a
bare address; the shared transport allows it. No portal link is published, since a plain-HTTP
link would leave the number in the clear, and the canary checks 17TRACK instead.

## Notes

- The service matches a number exactly as written: the order's tracking number, the shipper's
  reference, the waybill code or the channel's transfer number, dashes included. A record counts
  only when one of those is the whole number asked. Two orders under one reference stay
  inconclusive.
- GZYL writes a shipment's timeline ahead: every row carries the same creation time, days before
  most of the scan times. The tracker's latest row was never later than the lookup, but the
  adapter does not rely on that: a row dated after the lookup on Beijing time is held back, and
  an order whose rows are all ahead has no history yet. The record's own summary status is not
  read; the stage comes from the rows kept.
- Rows carry wall clocks without an offset, abroad too, and stay `local_time`.
- A record that names its channel and the channel's transfer number hands the parcel over when
  the channel label is in the platform's table, the delivery carrier's own detection offers the
  number and it serves the destination. The table holds Swiss Post's labels, the destination of
  every record seen; no live record has named a channel yet. The page names no channel or service.
- Recipient, sender, address, postcode, weight, fee, signature, signatory and delivery photo
  fields are never read; postcodes and signatories are cut from scan text.

## Limitations

A reference stored without its dashes is not found. A record with the delivery carrier's number
but no channel label hands nothing over.

## Numbers

GZYL's waybills are YL, ten digits and YQ, made by a Hualei number rule. Many forwarders end
their numbers with YQ and Yili International's are YL, nine digits and YQ, so the rule has low
confidence and recognition asks the tracker. No public GZYL number has been found, so the
corpus holds a synthetic one. The tracker accepts both the waybill's tracking number and its
reference number.

## Testing

`npm run test:carriers:live -- carriers/gzyl`, with `GZYL_TRACKING_NUMBER` and optionally
`GZYL_UNKNOWN_NUMBER` set outside the repository.
