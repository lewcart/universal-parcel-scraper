# Tianhui Hengyuan

Tracks shipments of Tianhui Hengyuan (天汇恒源, also written TH or THHY), a Chinese forwarder,
on its own tenant of the Hualei (华磊) forwarder platform. The client is shared with
[GZYL](../gzyl/README.md), whose README describes the platform; this carrier keeps its host and
status map.

## How it works

1. `direct`: one GET to `selectTrack.htm?documentCode=<number>` on the tracker at
   `134.175.221.174:8082`, then, when the interface holds no row for the number, one POST of the
   same `documentCode` to the tracking page `trackIndex.htm`, which settles not-found
   ([hualei.ts](../gzyl/hualei.ts)).
2. `retry`: the same read once more after a request fails to reach the tracker or hangs.

The tracker answers plain HTTP only, on a bare address. No account, key, cookie, CAPTCHA or
browser is needed, and no portal link is published.

## Notes

- After the forwarder's own two scans, its custom track product (named 轨迹定制, a customised
  track) shows rows that read like China Post's, all on the same second of the minute and coded
  `CO_C_CR`. They are what the tracker shows and are kept, but a row dated after the lookup on
  Beijing time is held back.
- A row's kind code (`ARRIVAL`, `SHIPMENT`, `CO_C_CR`) is kept as the provider code; it groups
  many wordings, so the stage comes from the wording in [status.ts](status.ts).
- Scan times are wall clocks without an offset, on the tracker's Beijing clock abroad too, as
  [GZYL's](../gzyl/README.md) are, and are read on it.

## Limitations

A reference stored without its dashes is not found. The rows after the forwarder's own scans
cannot be checked against a post's tracker: the record names no post number.

## Numbers

Tianhui Hengyuan's waybills are AT, ten digits and TH, made by a Hualei number rule. Neither
part is the carrier's name, so the rule has low confidence and recognition asks the tracker.
No public number has been found, so the corpus holds a synthetic one.

## Testing

`npm run test:carriers:live -- carriers/thhy`, with `THHY_TRACKING_NUMBER` and optionally
`THHY_UNKNOWN_NUMBER` set outside the repository.
