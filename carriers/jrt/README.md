# JRT

Tracks shipments of JRT (厦门今日通商贸有限公司, Jinritong), a Xiamen forwarder, on its own tenant
of the Hualei (华磊) forwarder platform. The client is shared with [GZYL](../gzyl/README.md),
whose README describes the platform; this carrier keeps its host and status map.

## How it works

1. `direct`: one GET to `selectTrack.htm?documentCode=<number>` on the tracker at
   `106.53.64.22:8082`, then, when the interface holds no row for the number, one POST of the
   same `documentCode` to the tracking page `trackIndex.htm`, which settles not-found
   ([hualei.ts](../gzyl/hualei.ts)).
2. `retry`: the same read once more after a request fails to reach the tracker or hangs.

The tracker answers plain HTTP only, on a bare address. No account, key, cookie, CAPTCHA or
browser is needed, and no portal link is published.

## Notes

- JRT's own numbers and shippers' references both find an order. Asked by reference, the result
  carries JRT's number as `canonical_tracking_number`.
- JRT's interface lists no row for an order without scans, under either number. The page shows
  the platform's own row, `货物电子信息已经收到`, on the order's creation time: the order is
  registered.
- Scan times are wall clocks without an offset and stay `local_time`; a row dated after the
  lookup on Beijing time is held back.

## Limitations

A reference stored without its dashes is not found. Only the platform's own row has been seen at
JRT, so its scan wordings fall back to the shared wording rules.

## Numbers

No public JRT number has been found, so no rule claims one. The tracker accepts both the
tracking number and the customer's reference.

## Testing

`npm run test:carriers:live -- carriers/jrt`, with `JRT_TRACKING_NUMBER` and optionally
`JRT_UNKNOWN_NUMBER` set outside the repository.
