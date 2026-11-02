# SPT Express

Tracks shipments of SPT Express (速派通国际物流, 速派通-辰途国际), a Yiwu forwarder running
cross-border parcel lines from China for e-commerce sellers, whose site is sptexp.com, on its own
tenant of the Hualei (华磊) forwarder platform. The client is shared with
[GZYL](../gzyl/README.md), whose README describes the platform; this carrier keeps its host and
status map. Universal providers name it SPT. SPT Furniture Logistics, a Polish furniture carrier,
is a separate entry.

## How it works

1. `direct`: one GET to `selectTrack.htm?documentCode=<number>` on the tracker at
   `106.52.159.115:8082`, which the site links, then, when the interface holds no row for the
   number, one POST of the same `documentCode` to the tracking page `trackIndex.htm`, which
   settles not-found ([hualei.ts](../gzyl/hualei.ts)).
2. `retry`: the same read once more after a request fails to reach the tracker or hangs.

The tracker answers plain HTTP only, on a bare address. No account, key, cookie, CAPTCHA or
browser is needed, and no portal link is published, since a plain-HTTP link would leave the
number in the clear.

## Notes

- A record counts only when one of its numbers is the whole number asked.
- Rows carry wall clocks without an offset on the platform's Beijing clock and are read on it:
  a universal provider's copies of SPT's rows show the same instants read that way.
- A row the track interface says was written more than twelve hours before its own clock is a
  forecast, not a scan, and is held back and named in `written_ahead`, as on every tenant of the
  platform; so is a row dated after the lookup. Some rows are written days after their clocks, in
  an evening batch; those are scans and are kept. Unlike GZYL's, SPT's records show neither a
  timeline written ahead nor a delivery row written in such a batch, so its delivery rows are not
  held back.
- The first row, "Item inbound scanning" under the platform's kind `ARRIVAL`, is the parcel
  reaching SPT's warehouse in China, the receiving point other tenants word as 到达收货点, and
  is accepted. The export clearance row is written in Chinese and English together and is kept
  as written.
- The record's product name is the service name and its consignee country the destination. The
  record's own summary status is not read.

## Limitations

Rows the status map does not list are staged from their wording by the shared language rules.
No public record shows a delivery or the last-mile carrier's number, so no hand-over is read.

## Numbers

SPT's waybills are `SPT`, twelve digits and `YQ`, the layout of forwarders on the platform, which
open their waybills with their own code and end them with YQ, as GZYL and
[Xinghe Freight](../xinghe-freight/README.md) do. SPT numbers them in sequence, so a made-up
number low in the range can be a real waybill; the corpus holds one far beyond the range in use.
`sptexp-1` has low confidence, and recognition asks the tracker.

## Testing

`npm run test:carriers:live -- carriers/sptexp`, with `SPTEXP_TRACKING_NUMBER` and optionally
`SPTEXP_UNKNOWN_NUMBER` set outside the repository.
