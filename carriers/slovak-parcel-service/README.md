# Slovak Parcel Service

Slovak Parcel Service parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

SPS parcel numbers are fourteen digits. Lookups archived from SPS's tracker in 2024 write them
in three groups: `703`, Slovakia's country code, a three-digit depot and an eight-digit serial.
Some lookups leave out the `703`, and the tracker's result address then names the whole parcel
number. `slovak-parcel-service-1` suggests SPS at low confidence for fourteen digits starting
`703`, a length the DPD networks and other carriers also print. Without the prefix the number
is eleven digits, a length several carriers share, so no rule claims it. One lookup carries two
digits more than a parcel number and is quarantined.

## Links

SPS's tracker opens one shipment at `www.sps-sro.sk/moja-zasielka/?shipment_id={number}`: the
page reads the number from the address and runs the search. Lookups archived from its earlier
pages put the same parameter on `/sledovanie-zasielky/`, which now redirects there with the
query, and on `/en/track-trace/`. The former Webtrace tracker on `t-t.sps-sro.sk` takes the
number in separate country, depot and serial fields, so its addresses hold no whole number.

## Testing

Provider live-test inputs and commands are in the [provider READMEs](../../providers/README.md).
