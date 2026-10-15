# Nim Express

Nim Express parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Archived lookups on Nim Express's tracker show bill numbers of thirteen digits, with a few of
twelve. Many carriers use those shapes, so Nim Express has no rule.

## Links

The search box on nimexpress.com sends the number to `/web/p/tracking` in its `h_i` parameter,
and the page fills its tracking form from it. Older lookups used the `i` parameter.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
