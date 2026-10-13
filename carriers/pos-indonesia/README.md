# Pos Indonesia

Pos Indonesia parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Pos Indonesia prints three layouts. International items carry UPU S10 numbers ending `ID`,
which postal detection handles. Domestic barcodes in complaints and Pos Indonesia's replies
are either eleven digits, which other carriers print too and no rule claims, or `P`, a
six-digit posting date and seven digits, which `pos-indonesia-1` suggests.

## Links

The tracking form opens `posindonesia.co.id/id/tracking/{number}`, or `/en/` for the English
page, and the library reads the number from either. Older pages passed it as `resi` on
the tracking page, which the library also reads.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
