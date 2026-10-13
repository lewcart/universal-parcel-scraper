# Saudi Post

Saudi Post parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

International items carry UPU S10 numbers ending `SA`, which generic postal detection offers.
Archived lookups on SPL's tracker also show `CRDSAL` and ten digits, which `saudi-post-1`
claims; no other carrier uses the prefix. Other six-letter prefixes appear with the same ten
digits, one sample each, and stay unclaimed. The tracker also takes Naqel's eight-, nine-,
thirteen- and fourteen-digit waybills, which belong to Naqel.

## Links

The tracker opens `splonline.com.sa/en/shipmentdetailsstatic/?tid={number}`; several numbers
are joined with `~`. The Arabic page under `/ar/` takes the same parameter.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
