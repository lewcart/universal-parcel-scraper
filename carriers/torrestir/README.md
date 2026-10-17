# Torrestir

Torrestir parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Torrestir is a Portuguese road carrier for parcels and pallets, with branches across Portugal,
in Spain and in Germany. Its tracker shows a tracking code, the sender's reference and
Torrestir's own reference.

The tracking code is M001, four digits, a letter or digit, and eleven digits that hold the
zero-padded guia number and one more digit. Customers quote it in Portal da Queixa complaints,
and Torrestir's own emails head a delivery with it. `torrestir-1` claims it with high
confidence; no other carrier's corpus or rule has the shape.

Torrestir's reference is the guia de transporte, written as 0, 10, one digit and eight digits
separated by dots. Customers and Torrestir's claim files quote it, and Torrestir also writes
the bare eight digits. Without its dots the dotted form is a twelve-digit run, and the bare
form is an eight-digit run; many carriers share both shapes, so no rule claims either.

A Spanish sender can hand a parcel to CBL Logística, which passes it to Torrestir in Portugal.
The tracking code such a sender gives stays in quarantine until a source ties it to
Torrestir's own network.

## Links

The tracker at `tracking.torrestir.com` opens one parcel from its `id` parameter, the address
the Track & Trace box on `www.torrestir.com` builds. The site builds it on `http`, which
redirects to the same address on `https`.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
