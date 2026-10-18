# Nova Global

Nova Global parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Nova Global, formerly Nova Poshta Global and before that Nova Poshta International, is the
international arm of Nova Poshta. It carries parcels into and out of Ukraine on its own
waybills and tracker, then hands them to Nova Poshta for the last mile. That domestic leg
belongs to the nova-poshta entry: Nova Global's tracker lists the Nova Poshta waybill among a
parcel's additional numbers, next to the sending carrier's number.

Nova Global's own express waybills end in NPG. Archived lookups on its tracker show two
letters, nine to sixteen digits and NPG, with NP, WB, OG and YW in front. Rule nova-global-1
claims that shape with high confidence because no other carrier ends its numbers with NPG.

## Links

One parcel opens on nova.global under `/track/` with the number in the `Tracking_ID` parameter,
after an optional language prefix. The tracker's share button builds that address, and archived
lookups on the former novaposhtaglobal.ua host use the same path. The library reads the number
from both hosts.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
