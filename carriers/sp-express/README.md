# SP Express

SP Express parcels use enabled universal providers. There is no dedicated adapter.

SP Express, formerly Świat Przesyłek, is a Polish postal operator and consolidator. Its Nysa
hub takes parcels from Polish senders and from Cainiao's economy flow and hands them to partner
networks for final delivery, so the history it shows often comes from those partners.

## Numbers

Its own order numbers are fifteen digits: 483, the sending date as YYMMDD and six digits.
Archived lookups on its tracker show this layout, and the opened ones carry a sending date that
matches the middle digits. `sp-express-1` suggests SP Express for it at low confidence, because
BRT and Yunda accept any fifteen digits.

Its Cainiao page tracks a destination country code and twelve digits. Too few of these are
known to tie the layout to SP Express alone, so no rule claims them. Partner numbers that its
tracker also accepts are not its own.

## Links

`sp.express/tt/{number}` and `en.sp.express/tt/{number}` open one parcel, as did the former
swiatprzesylek.pl host, which now redirects to sp.express. Cainiao parcels open at
`/tt-cainiao/{number}`.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
