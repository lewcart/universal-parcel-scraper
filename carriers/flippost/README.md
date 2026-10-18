# Flip Post

Flip Post parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Flip Post (Флиппост) is a Moscow express courier with its own branches and agents across Russia
and international document and parcel services. Its number is a waybill (накладная) written as
digit groups joined by dashes: a short prefix, then the serial. The tracking API manual, the
client cabinet help and court rulings that cite Flip Post waybills show two digits and seven,
two digits and two groups of three, and three or four digits and four. Detection drops the
dashes, which leaves bare runs of seven to nine digits that many carriers share, so no rule
claims them and the gaps are declared.

## Links

The tracking form on the home page and on the tracking page sends the waybill in the `number`
parameter of `flippost.com/instruments/online/`, so that address opens one parcel. The library
reads the number from it.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
