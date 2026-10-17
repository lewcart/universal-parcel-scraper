# GoTo Logistics

GoTo Logistics parcels use enabled universal providers. There is no dedicated adapter.

GoTo Logistics (GTL) is an Indonesian fulfilment and delivery company that started in the GoTo
group. It delivers marketplace orders with its own fleet and partner couriers and tracks them
from pickup to delivery under its own number.

## Numbers

GTL numbers on its tracker are TKGTL, a hyphen, then eleven digits and capital letters. The
library compares numbers without hyphens, so `gtl-goto-1` claims TKGTL followed by eleven
digits and capital letters; no other carrier's numbers or rules use that prefix.

## Links

The tracking form opens `gtl.id/tracking?tracking_number={number}`, which looks the number up
when the page loads. Archived lookups use the same address on `www.gtl.id`, which no longer
resolves.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
