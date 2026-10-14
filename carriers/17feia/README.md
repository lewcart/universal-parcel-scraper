# 17FEIA

17FEIA (上海宏杉国际物流) consolidates parcels in Shanghai and Shenzhen, flies them to Europe or
the United States and hands them to a delivering partner such as DPD Germany, DHL or FedEx.
Tracked through the lookup its tracking page makes.

## How it works

1. `direct`: one `GET https://www.17feia.com/public/v1/ordeSearch/listTrackInfos/{number}`, as
   the tracking page's script sends it. It needs no cookie, token, key, account or browser. The
   JSON reply holds the order, its delivering partner and number, and its rows with English
   descriptions; `listZhTrackInfos` gives the same rows in Chinese.
2. `retry`: one more try when the request fails to reach the site or hangs. The first try gets
   half of the budget.

- The lookup also finds an order by its partner's number or another forwarder's number, so the
  order counts only when its own number is the one asked.
- `flag: false` with nothing else is the unknown-order answer; the lookup gives the same for a
  box number and for anything that is not a number. Any other refusal, or an order without
  rows, is inconclusive.
- Redirects are not followed. A redirect to the site's cookie check, or an Aliyun bot check in
  place of the reply, is a challenge.
- Recognition makes the same request.

## Notes

- Every row carries 17FEIA's label in Chinese whatever the reply's language. The map reads the
  label; rows relayed from the partner share one label, so their stage comes from the partner's
  wording. The broker's "delivered to warehouse" is customs, and the row written before the
  warehouse has the parcel is a registration.
- A row's `timeZone` is trusted only beside a country whose clock has that offset at that time:
  the warehouse's rows and the partner's relayed scans. 17FEIA's milestones carry the
  destination's standard offset over a wall clock orders to other destinations share, and name
  no country, so they keep their wall clocks.
- The estimated departure is written before the flight and is no scan: the adapter drops it.
  Rows dated after the read are dropped too.
- The partner is handed over from an explicit table of 17FEIA's names: `DPD-DE` to `dpd-de`,
  `DE-DHL` to `dhl` and `FEDEX-GROUND` to `fedex`, and only when the partner's detection accepts
  the number. A DPD number is passed as the fourteen digits DPD's tracking takes, without a
  label's check character. Other names give no hand-off.
- The rows' postcodes and states, the order id and the weight are never read.

## Limitations

- No delivery estimate, delivery time, weight, service, sender or recipient.
- Box numbers, the order number with a box suffix, are not looked up: the lookup does not answer
  them.
- Parcels bound for Poland or the Netherlands ride on DPD Germany's labels; once they leave
  Germany, `dpd-de`'s answer for them is inconclusive.
- A first visit to the tracking link lands on the cookie check, which reloads the home page
  without the number.

## Testing

`SEVENTEENFEIA_TRACKING_NUMBER=... SEVENTEENFEIA_UNKNOWN_NUMBER=... npm run test:carriers:live -- carriers/17feia`
