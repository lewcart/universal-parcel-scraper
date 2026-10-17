# TWS Express Courier

TWS Express Courier parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

T.W.S. Express Courier is a courier from the Milan area that works with SDA, Poste Italiane's
express arm. Its waybills are thirteen characters: `28`, four digits, a letter and six digits,
or thirteen digits in older lookups. Archived lookups on its tracker and complaints answered by
the company or by senders show them. `tws-express-1` suggests TWS at low confidence for the
lettered layout, which SDA's own waybills also use and Poste Italiane's SDA rule suggests too;
recognition decides. The all-digit layout is shared by many carriers and stays unclaimed.

TWS also delivers Poste Delivery Business parcels for Poste Italiane. Complaints about TWS
quote their `1UW` waybills, which stay with Poste Italiane's rule because Poste's tracker
follows them.

## Links

The tracking page on `twsexpresscourier.it` builds `mytws.it/tracking-status;ldv={number}`,
and senders send that address to their customers. The older tracker opened one parcel at
`twsexpresscourier.it/Ricerca.aspx?ldv={number}`. The library reads the number from both.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
