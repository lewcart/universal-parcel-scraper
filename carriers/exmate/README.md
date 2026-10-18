# Exmate

Exmate parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Exmate (이엑스메이트) flies e-commerce parcels from Korea to Japan. Its tracker numbers them EXK,
eight digits and J, and archived lookups show that layout from registration in Korea to customs
clearance in Japan. The `exmate-1` rule claims it.

In Japan the tracker names the local carrier, such as Sagawa or Japan Post, and that carrier's
own number, which stays with its rule.

## Links

The tracker's form opens `pod.exmate.net/pod/?exmno={number}`, and archived lookups use that
address. Numbers starting EXJ and ending J open `pod.exmate.net/pod/jpjp?exmno={number}`
instead.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
