# Packs

Packs parcels use enabled universal providers. There is no dedicated adapter.

Packs is a next-day parcel service for the Benelux that delivers through more than sixty
partner companies.

## Numbers

A customer's review on Packs' Trustpilot page gives two eight-digit shipment numbers. Archived
lookups on Packs' tracker show eight digits too, and references that start with `A`, `U`,
`UTV` or `GRZ`; none is kept, because each lookup also carries the recipient's postcode. Eight
digits are a bare counter that many carriers print, so no rule claims them.

## Links

The tracker needs the shipment number and the recipient's postcode. Its address carries the
number as `zendingnr` next to the postcode, so the library can read the number from it but has
no template to build one.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
