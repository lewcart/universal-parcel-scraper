# Fargo

Fargo parcels use enabled universal providers. There is no dedicated adapter.

Fargo (Fargo Parcel Service) is an Uzbek courier delivering within Uzbekistan and abroad. It is
not the Kenyan Wells Fargo courier.

## Numbers

Its tracker takes a track ID or the shop's order number. Archived lookups show nine- and
fourteen-digit ids, and the tracker's placeholder shows TEZ and six digits. The digit runs are
printed by many carriers, and the TEZ prefix seems to come from the delivery platform Fargo's
tracker runs on, so no rule claims them.

## Links

The tracker reads the number from `id` on `fargo.uz/track` and its Russian and Uzbek pages, and
older lookups used `my.fargo.uz/track/?id={number}`. Both are read as links.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
