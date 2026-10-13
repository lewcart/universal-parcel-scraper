# Flash Express

Flash Express parcels use enabled universal providers. There is no dedicated adapter.

Flash Express is a domestic parcel network in Thailand.

## Numbers

Thai tracking numbers start with `TH`, then four digits and seven or eight letters and digits,
ending with a letter. A low-confidence rule suggests Flash Express for that layout, since other
Thai networks also print `TH` numbers; a rarer form with a trailing digit after the final
letter stays unclaimed.

## Links

The tracker reads one or more numbers from the `se` parameter of `/fle/tracking` on
`flashexpress.co.th`, with or without a language prefix. The former tracker used `/tracking/`
with the same parameter.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
