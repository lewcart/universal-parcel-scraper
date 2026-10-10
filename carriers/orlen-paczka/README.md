# ORLEN Paczka

ORLEN Paczka parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

ORLEN Paczka's tracker takes the parcel number or the sending code. Lookups archived from it
since 2021 show thirteen digits starting `210` and ending in a GS1 check digit, the series
rising over time. `orlen-paczka-1` suggests ORLEN Paczka for that layout at low confidence,
because several carriers match thirteen digits broadly. The tracker's script also accepts
thirteen characters starting `3` and seven or ten digits, which no lookup showed and no rule
claims. Parcels sent through Allegro Delivery, numbered from `AD`, are tracked at Allegro.

## Links

ORLEN Paczka's tracker opens one parcel at `www.orlenpaczka.pl/sledz-paczke/?numer={number}`,
the address its copy-link button builds and the shape of the archived lookups.

## Testing

Provider live-test inputs and commands are in the [provider READMEs](../../providers/README.md).
