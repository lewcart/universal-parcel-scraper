# DPD Austria

DPD Austria parcels use enabled universal providers. There is no dedicated adapter.

DPD Austria is DPDgroup's network in Austria. Its own tracker is myDPD on `mydpd.at`, apart
from the `dpd.com`, `dpdgroup.com` and `tracking.dpd.de` pages that the other `dpd-*` entries
read. DPD's group tracker also shows Austrian parcels with their depot scans, but the DPD
Germany adapter leaves parcels outside Germany unconfirmed.

## Numbers

Parcels carry DPD's fourteen-digit parcel number, whose first four digits are the issuing
depot. DPD Austria's depot list gives its depots the codes 0620 to 0630, 0632 to 0635, 0643 to
0645 and 0649, and archived replies of DPD's group tracker show parcels with those codes
scanned at Austrian depots. `dpd-at-1` claims fourteen digits starting with one of those codes
at low confidence and lists DPD Austria first, as DPD Switzerland's rule does for its own depot
codes. Like DPD France's rules, it keeps recognition from asking the DPD networks, whose guest
API would file the parcel under DPD Switzerland. Other fourteen-digit numbers stay with the
other DPD entries' low rules.

## Links

DPD Austria's page on `dpd.com` builds `www.mydpd.at/?f=parcel.load&p={number}`, which opens
one parcel. Archived lookups also use `mydpd.at/meine-pakete?ipn={number}`. Both are read for
DPD Austria.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
