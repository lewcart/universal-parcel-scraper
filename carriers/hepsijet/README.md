# HepsiJET

HepsiJET parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

HepsiJET tracks the codes its merchants put on their labels, so the numbers have many layouts:
twelve letters and digits, `KJET` codes, merchant prefixes such as `ITX`, `GLV` or `oto`
followed by digits, `HM` codes ending `TR`, and plain runs of twelve or fourteen digits.
Prefixes belong to merchants and digit runs are shared with other carriers, so no rule claims
them.

## Links

HepsiJET's tracker shows one parcel at `hepsijet.com/gonderi-takibi/{number}`, and archived
lookups also use `coklu-gonderi-takibi`, its multi-shipment page, with one number. The library
reads the number from those addresses but builds none, because the site blocks automated checks
of its search page.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
