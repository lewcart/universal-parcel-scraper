# T-CAT

T-CAT parcels use enabled universal providers. There is no dedicated adapter.

T-CAT (黑貓宅急便) is President Transnet's door-to-door parcel network in Taiwan. It carries
Yamato Transport's black cat brand but runs its own tracker and numbers; `yamato` covers Japan.

## Numbers

T-CAT's help pages ask for the ten-digit number at the top right of the waybill, typed without
hyphens. Archived lookups on its tracker show ten-digit numbers and, on newer waybills,
twelve-digit ones. No rule claims them: bare ten- and twelve-digit numbers are printed by many
carriers.

## Links

`t-cat.com.tw/Inquire/TraceDetail.aspx?BillID={number}` opens one parcel. Archived lookups use
it with and without a `ReturnUrl` parameter; the parameter name and path are case-insensitive.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
