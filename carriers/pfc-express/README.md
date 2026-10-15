# PFC Express

PFC Express parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

PFC's order numbers read `R`, a six-digit account, the six-digit order date and a four-digit
serial. PFC's own inquiry page shows them with their history next to the delivering service's
number. A low-confidence rule suggests them, because Colis Privé's seventeen-character
candidate also fits most of them. Postal, USPS and other numbers on the same page stay with
their own carriers.

## Links

The tracker at `pfctrack.com` reads numbers from `nums` or `no` and writes `?nums=` back after
a search, so `www.pfctrack.com/?nums={number}` opens a lookup. The older inquiry page on
`pfcexpress.com` read `txtID` and now redirects to the tracker.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
