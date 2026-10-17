# Hermes Austria

Hermes Austria parcels use enabled universal providers. There is no dedicated adapter.

Hermes Austria is the Hermes network in Austria, with its own tracker on `myhermes.at`, apart
from Hermes Germany's `myhermes.de` that `hermes-de` reads. Austrian Post delivers its parcels
and Hermes Germany carries those crossing the border; the tracker shows both legs.

## Numbers

Parcels carry Hermes's fourteen-digit parcel number. Archived lookups on the tracker show it
for parcels posted at Austrian PaketShops and for parcels coming from Germany, sometimes beside
Hermes Germany's H number, which `hermes-de` claims. Hermes Germany's checksum rule and the DPD
networks' rules already suggest fourteen digits and nothing in the number names the Austrian
network, so no rule claims it for Hermes Austria and detection does not offer it. The tracker
also answered for a twenty-two-digit number, the length of Austrian Post's barcodes; the corpus
keeps it for review and `austrian-post-1` suggests that layout.

## Links

The tracker opens one parcel at `myhermes.at/sendungsverfolgung/trackingnummer/{number}/`, and
the English page at `/en/tracking/trackingnummer/{number}/`. Both are read for Hermes Austria.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
