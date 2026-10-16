# DPD Belgium

DPD Belgium parcels use enabled universal providers. There is no dedicated adapter.

DPD Belgium is DPD's network in Belgium. Its tracking page on dpd.com hands the number to
myDPD, DPD's consumer site, which also serves [DPD Switzerland](../dpd/README.md). The myDPD
guest service behind the `dpd` adapter answers for Belgian parcels too, but that adapter
recognizes Swiss parcels only.

## Numbers

DPD Belgium parcels carry DPD's fourteen-digit parcel number, which every DPD network shares.
DPD Belux's label specification calls the first four digits a range code naming the sending
entity, and its values are not published. Belgian parcels start with different ranges, so no
rule claims the number. The samples and their sources are in [`numbers.json`](numbers.json).

## Links

DPD Belgium's tracking page opens one parcel at
`www.dpdgroup.com/be/mydpd/my-parcels/track` with the number in `?parcelNumber=`. myDPD links
are read as [DPD Switzerland](../dpd/README.md)'s, whose rules take the whole domain.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
