# TSJY

TSJY (通世集运) consolidates parcels in its warehouse in Kunshan, near Shanghai, and sends them
abroad on a line such as 17FEIA's. Tracked through the lookup the order search on its site makes.

## How it works

1. `direct`: one `POST https://www.tsjy56.com/oms/api/v1/public/track/query` with
   `{"nos":["…"]}`, as the site's order search sends it to open an order's history. It needs no
   cookie, token, key, account or browser. The JSON reply holds the order's number, the line's
   number (`channelNo`) and every row: TSJY's own warehouse steps in Chinese and the line's rows
   in English.
2. `retry`: one more try when the request fails to reach the site or hangs. The first try gets
   half of the budget.

- The search also finds an order by its line's number, so the order counts only when its own
  number is the one asked.
- An empty list is the unknown-order answer, which the page shows as 未找到相关的轨迹信息. A
  refusal (`errcode` other than 0), an order whose own lookup did not succeed and an order
  without rows are inconclusive.
- The phone page's `order/query` gives the order's destination and channel without its rows,
  and `order/get` gives the rows from the order's internal id. `track/query` needs neither, so
  the id, which opens the order, is never read.
- Recognition makes the same request.

## Notes

- TSJY's server stamps its own steps in epoch milliseconds: those are instants, given on Beijing
  time. The line's rows come in whole seconds because TSJY reads 17FEIA's wall clocks as Beijing
  time. That matches 17FEIA's offset only at its Chinese warehouse, so those rows keep the wall
  clock.
- The map names TSJY's steps and 17FEIA's milestones as they read in TSJY's journey: 17FEIA's
  order data comes while TSJY still holds the parcel, and its receipt after TSJY's dispatch is
  transit. A later carrier's announcement or receipt is transit too; other relayed wording goes
  through the shared rules. The broker's "delivered to warehouse" is customs.
- The line is handed over from its number: `17feia` when the number is one of 17FEIA's order
  numbers, else the one carrier whose high-confidence rule claims it, else nobody. The channel's
  name does not name the delivering carrier (an EU DHL channel can end with DPD Germany) and is
  not read. 17FEIA's own result names its delivering partner.
- 17FEIA's estimated departure is no scan, so the adapter drops it with rows dated after the
  read and repeated rows.
- The order's status code is not read: the rows give the stage.

## Limitations

- No delivery estimate, weight, destination, service, sender or recipient.
- Only TSJY's own order numbers are looked up.
- Whether TSJY relays the delivering partner's scans after 17FEIA's flight has not been seen;
  the line's adapter has them.

## Numbers

TSJY's tracker takes its own order numbers and the numbers of the lines it books parcels on.
No public TSJY number was found, so no rule claims one.

## Testing

`TSJY_TRACKING_NUMBER=... TSJY_UNKNOWN_NUMBER=... npm run test:carriers:live -- carriers/tsjy`
