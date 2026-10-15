# TK Energia

TK Energia parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

A consignment is tracked by the number of its forwarding receipt. The tracker page asks for
seven digits, optionally after a branch prefix and a dash. Archived lookups on the carrier's
tracking API show four-digit prefixes. A low-confidence rule suggests the carrier for that
dashed layout as typed; without the dash it is eleven digits, which many carriers share. Bare
seven digits and three-digit prefixes also fit other carriers' numbers, so no rule claims them.

## Links

`nrg-tk.pro/client/tracking/#{number}` opens one consignment: the tracker page reads the number
from the fragment and writes it there after a search. The old nrg-tk.ru tracker address
redirects to nrg-tk.pro. The tracker shows the current state, route and delivery window, not a
history.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
