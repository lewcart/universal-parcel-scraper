# Early Bird

Early Bird parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Lookups archived from Early Bird's tracker show twenty-digit SSCCs starting `00`, under Swedish
GS1 company prefixes, and on its older tracker nineteen-digit numbers starting `999`. An SSCC
names whoever issued it rather than the carrier, and none of the nineteen-digit numbers could
be kept, so no rule claims either layout.

## Links

Early Bird's tracker at `earlybird.se/spara-och-hjalp` reads the number from its `id` parameter
and looks it up when the page opens; the older `earlybird.se/tracking/` address forwards there
with the parameter. Links from its earlier tracker on `track.earlybird.se` carry the number in
the `a` parameter. The library reads all three.

## Testing

Provider live-test inputs and commands are in the [provider READMEs](../../providers/README.md).
