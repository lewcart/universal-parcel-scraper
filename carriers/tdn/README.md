# TDN

TDN parcels use enabled universal providers. There is no dedicated adapter.

TDN is a Spanish road network for industrial and commercial parcels, serving mainland Spain,
the islands, Ceuta, Melilla and Portugal. Kuehne+Nagel owns it; TDN keeps its own brand and
tracker, separate from the Kuehne+Nagel entry.

## Numbers

Expedition numbers are twelve digits starting with 9999. TDN's tracking page gives that layout
as its example, and archived lookups on its tracker show it. Other carriers' twelve-digit
numbers also start with 9999, so no rule claims them.

## Links

The tracking page on tdn.es reads an `envio` parameter and, with `autoredir=1`, forwards it to
the tracker at `tracking.tdnonline.com/consulta_expediciones/tracking`, which reads
`REFERENCIA`. Both addresses open one parcel.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
