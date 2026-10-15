# PostEx

PostEx parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

PostEx tracking numbers seen in archived lookups on its tracker are fourteen digits. Fourteen
digits are printed by many carriers and no known prefix or check digit sets PostEx apart, so no
rule claims them; a caller names the carrier or pastes a tracking page link. PostEx took over
Call Courier, whose tracking page now leads to PostEx.

## Links

The tracking page on postex.pk looks up the number it finds in `cn` when it opens. The library
reads the number from that address.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
