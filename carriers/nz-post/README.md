# NZ Post

Tracks domestic parcel barcodes, courier labels and postal references through
the anonymous consumer service used by NZ Post's tracking page.

## How it works

One GET returns the parcel reference and actual tracking events. No account,
API license, cookie or browser is required. Only one exact returned reference
is accepted; consignments that expand into several parcels are inconclusive.

## Notes

A courier label is sixteen digits followed by a depot code, three digits and a
two-letter suffix. The tracker answers only the whole label, so detection claims
that shape and the adapter sends it unchanged.

The short status and depot name provide the timeline. International mail scans
carry their own EDIFACT codes; the border agency's hold is customs and its
release resumes transit. The depot placeholder for a scan with no place is
dropped. Longer descriptions,
signatures and delivery assets contain recipient data and are excluded.
Pickup requests remain pre-advice until a collection scan occurs. Empty history
is inconclusive; only the service's specific absence response is negative.

## Limitations

Explicit offsets establish event instants, except abroad. NZ Post reads the
wall clock of a scan abroad as New Zealand's: a Guangzhou customs scan at 12:47
local came as `00:47Z`, 12:47 in Auckland, where UPU dates it 12:47 at the
Guangzhou office of exchange (checked 2026-10-10). So on an item NZ Post sends
abroad (an S10 number ending `NZ`), each scan after the international departure
gets its wall clock back on Auckland's. It is read on the clock of the country
its depot names ("Hong Kong"). When the depot names a town ("GUANGZHOU") or a
country with several clocks, it borrows a zone, a guess: that of the nearest
earlier scan abroad that is placed, else of the nearest later one. With none,
it stays a wall time (`local_time`). Airline scans
("In transit with airline") are taken as sent: their clocks were not checked.
Missing, malformed or offsetless clocks preserve the source order without
borrowing an older scan's timestamp.
See [ROUTING.md](https://github.com/plhery/delivery-tracker/blob/main/docs/ROUTING.md) for unresolved history handling.
Delivery estimates and account-only delivery controls are not retrieved.

## Testing

Run `npm run test:carriers:live -- carriers/nz-post`.
Set `NZ_POST_TRACKING_NUMBER` outside the repository for a real parcel.
