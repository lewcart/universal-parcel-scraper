# OPT-NC

OPT-NC parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

OPT-NC, the post of New Caledonia, tracks international mail by UPU S10 numbers, which generic
postal detection handles. Its tracker also follows Colissimo parcels sent from France, whose
numbers stay with La Poste's rules. No public number of OPT-NC's own domestic service was
found, so no rule for OPT-NC claims a layout.

## Links

The tracker on `monespace.opt.nc` takes 13 letters and digits and opens the parcel at
`/mes-suivis/{number}`. Archived lookups on the former trackers passed the number as `itemid`
on `webtrack.opt.nc/ipswebtracking/IPSWeb_item_events.asp` and on
`webtracking-nca.ptc.post/IPSWeb_item_events.aspx`.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
