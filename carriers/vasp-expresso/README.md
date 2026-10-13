# Vasp Expresso

Vasp Expresso parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Vasp's Track and Trace page asks for the parcel's number. Its API calls that a service barcode
of thirteen digits; each volume adds a three-digit counter, giving sixteen digits. Customers
quote both in complaints, and returns dropped at Kios points carry thirteen-digit service
numbers starting `904`. Thirteen and sixteen digit runs are printed by many carriers, so no
rule claims them.

## Links

The Track and Trace page reads the number from `?search=` on
`vaspexpresso.pt/pt/geral/track-and-trace/` and runs the lookup, so that address opens one
parcel.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
