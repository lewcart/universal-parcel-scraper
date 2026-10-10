# Foxpost

Foxpost parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Foxpost's tracker asks for the parcel ID from the shipping email. Its pages say that locker and
pickup-point parcels carry an ID starting `CLFOX` or `Z` and home deliveries a number starting
`66639`, and that the barcodes start `CLFOX`. Lookups archived from its tracker are nearly all
`CLFOX` and fifteen digits, which `foxpost-1` claims; the few others match no layout Foxpost
describes. `Z` and ten digits is the layout of Packeta, which is merging its Hungarian lockers
into Foxpost, and stays with Packeta's rule. No archived lookup shows a home-delivery number,
so no rule claims that prefix.

## Links

Foxpost's tracking form sends the number as `code` to `foxpost.hu/csomagkovetes/`, so
`foxpost.hu/csomagkovetes/?code={number}` opens one parcel. Archived lookups also use the
English page, `foxpost.hu/en/parcel-tracking?code={number}`.

## Testing

Provider live-test inputs and commands are in the [provider READMEs](../../providers/README.md).
