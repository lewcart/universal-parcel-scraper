# Vinted Go

Vinted Go parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Lookups archived from Vinted Go's tracker show sixteen-digit numbers starting `17` whose last
digit passes the Luhn check; the leading digits grow over time like a Unix timestamp.
`vinted-go-1` suggests Vinted Go at low confidence for sixteen digits starting `17` or `18`
with that check, because DHL eCommerce, Evri and TNT accept any sixteen digits.

## Links

Vinted Go's tracker at `vintedgo.com/{language}/tracking` moves to
`vintedgo.com/{language}/tracking/{number}` when a search finds the parcel, so that address
opens one parcel. Lookups archived from it sometimes add `country` and `region` parameters.

## Testing

Provider live-test inputs and commands are in the [provider READMEs](../../providers/README.md).
