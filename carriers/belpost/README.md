# Belpost

Belpost parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Belpost's tracker takes only UPU S10 numbers: two letters, nine digits and two letters.
Archived lookups on belpost.by show its own items ending in `BY` with several service prefixes,
among them `BP`, `BV`, `VV`, `PE`, `CP` and `RR`. Generic postal detection handles S10 numbers,
so Belpost has no rule of its own. Items from other posts that Belpost delivers keep the suffix
of the post that issued them and stay with it.

## Links

The tracking page reads the number from its `number` parameter and looks it up when it opens,
so `belpost.by/Otsleditotpravleniye?number={number}` opens one parcel.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
