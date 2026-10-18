# TransMission

TransMission parcels use enabled universal providers. There is no dedicated adapter.

TransMission is a partnership of independent transport and distribution companies that covers
the Netherlands, Belgium and Luxembourg. It is not Transmission, the Northern Ireland pallet
network.

## Numbers

A shipment number is `T` or `P`, a two-digit depot code and twelve digits, printed in groups
of two, six and six. Each shipping unit's barcode adds three digits to it. The tracker's own
lookups and a complaint show the shipment layout, which `transmission-1` claims with low
confidence: a letter and fourteen digits is too plain to name the carrier alone. Unit barcodes
stay unclaimed.

## Links

The tracker opens a shipment at `api.trans-mission.nl/tt/{number}/{postcode}`, so it needs the
recipient's postcode as well. The library can read the number from such an address, but it
has no template to build one.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
