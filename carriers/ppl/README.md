# PPL

PPL parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

PPL's tracker takes the parcel number or a SmartPIN. Lookups archived from it between 2021 and
2026 show eleven-digit parcel numbers, most starting `40`, `70` or `20` and others `21`, `41`,
`44`, `45`, `60` or `80`. Numbers one apart both occur, so the last digit is no check digit,
and none is an SSCC or a UPU S10 number. Eleven digits are shared by several carriers, so no
rule claims them and the user picks PPL.

## Links

PPL's tracker opens one parcel at `www.ppl.cz/vyhledat-zasilku?shipmentId={number}`: the page
reads the number from the address and runs the search itself. Lookups archived from the English
site put the same parameter on `/en/track-a-shipment` and `/en/parcel-detail`.

## Testing

Provider live-test inputs and commands are in the [provider READMEs](../../providers/README.md).
