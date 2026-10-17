# DPD Portugal

DPD Portugal parcels use enabled universal providers. There is no dedicated adapter.

DPD Portugal is DPDgroup's network in Portugal, formed from Chronopost Portugal and SEUR
Portugal. It runs its own tracker on `tracking.dpd.pt`, apart from the `dpd.com` and
`dpdgroup.com` pages that the other `dpd-*` entries read.

## Numbers

Parcels carry DPD's fourteen-digit parcel number, which labels and shipping messages may follow
with a check character. Archived lookups on the tracker and complaints answered by DPD Portugal
show both forms. Every DPD network issues the same layout and the other DPD entries suggest it
with low rules; DPD Poland's preferred rule takes those starting with 13, a range DPD Portugal
issues too. No rule claims them for DPD Portugal, so detection does not offer it.

## Links

The tracker reads the number from `reference` on `tracking.dpd.pt/track-and-trace`, so
`?reference={number}` opens one parcel. DPD's Portuguese pages build the same address on
`dpd.pt`, which forwards to the tracker, and archived lookups also use the English page
`/en/getting-parcel/track-trace`.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
