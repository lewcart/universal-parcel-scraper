# Sendle

Sendle parcels use enabled universal providers. There is no dedicated adapter.

Sendle is an Australian parcel service for small businesses. The original company closed,
and Quantium Solutions' Australian operator bought the brand and runs it in Australia only.

## Numbers

The tracking number printed under the label's barcode is `QSS` and nine digits, and the
booking e-mail gives an order number of `QS` and six digits; the tracker takes both. The
tracking page's help text gives the `QSS` prefix and an example, which its tracker knows. With
one example for the length, `sendle-1` only suggests Sendle, ahead of the carriers whose rules
take any twelve characters. Purolator's rule for three letters and nine digits leaves `QSS` to
Sendle. Order numbers are a short counter that other carriers' rules share, so no rule claims
them. The original Sendle's references, `S` and five to seven characters, are no longer
tracked.

## Links

`sendle.com/tracking?ref={number}` opens the tracking page with the number filled in.

## Why there is no adapter

None has been written yet. The tracking page asks its backend in two JSON calls, between
which it solves a proof-of-work check, with no CAPTCHA or account. The universal providers'
Sendle entries were built for the original company.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
