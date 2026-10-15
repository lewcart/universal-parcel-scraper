# Ozon

Ozon parcels use enabled universal providers. There is no dedicated adapter.

## Limitations

Ozon's trackers and the lookups behind them sit behind Ozon's own bot check, which runs a script
in the browser before any lookup answers. The Ozon app passes the same check with a device
fingerprint and tracks only a signed-in customer's orders.

## Numbers

Ozon posting numbers are an order number of eight or ten digits, four digits and one digit,
joined by hyphens, as archived lookups on Ozon's trackers show. `ozon-logistics-1` claims them
when they are printed with their hyphens; without them the digits match other carriers'
numeric shapes. Ozon Rocket, the delivery service Ozon offered to other shops, tracked their
orders as `PL-`, a six-digit client code and the shop's own reference; `ozon-logistics-2`
claims that printed form. Ozon's tracker also shows numbers of partner carriers, mostly
Chinese postal items, which stay with those carriers.

## Links

The tracker at `tracking.ozon.ru` reads the number from its `track` parameter, so
`tracking.ozon.ru/?track={number}` opens one parcel. Ozon Rocket's tracker at
`rocket.ozon.ru/tracking/` takes it as `SearchId`.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
