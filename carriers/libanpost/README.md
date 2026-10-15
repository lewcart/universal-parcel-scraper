# LibanPost

LibanPost parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

International mail uses UPU S10 numbers, which postal detection handles. LibanPost's tracker
also takes numbers starting `PX`; too few are public to define their layout, so detection does
not claim them.

## Links

The tracker prefills one number from
`libanpost.com/english/tools-support/track-and-trace?sn={number}`, also under `/arabic/`; the
library reads the number from both. Showing the history needs a CAPTCHA.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
