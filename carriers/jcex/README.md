# JCEX

JCEX (佳成国际物流有限公司, Hangzhou Jiacheng International Logistics) sends parcels from China
and hands them to a delivering partner in the destination, such as USPS in the United States.
Tracked through the lookup its tracking page makes.

## How it works

1. `direct`: one `POST https://track.jcex.com/api/track/tracking` with
   `{"numberList":["<number>"]}`, as the tracking page's script sends it. It needs no cookie,
   token, key, account or browser. The JSON reply holds one entry per number with JCEX's
   waybill and order numbers, the shipment's status and its rows newest first, each in English
   and Chinese with a place, a country and an offset.
2. `retry`: one more try when the request fails to reach the site or hangs. The first try gets
   half of the budget.

- The shipment counts only when its waybill or order number is the one asked.
- An unknown number comes back with neither number and the status `NotFound`. A waybill JCEX
  has printed but not scanned comes back with its numbers, the same status and no rows: it has
  no history yet. Any other refusal is inconclusive.
- Redirects are not followed, and a bot check in place of the reply is a challenge.

## Notes

- JCEX files every row under one of 17TRACK's sub-statuses (`platformEventCode`), and the map
  reads that code: JCEX's own event codes group rows of several stages. The origin warehouse's
  "Arrive at the delivery point" is the parcel reaching JCEX, which the shared rules would read
  as a parcel waiting for collection. Rows without a code are read by their wording.
- A row is read on the clock its place keeps: its country's when the country has one, and in
  the United States its state's when the place names one, as USPS writes it. A row whose place
  is a bare country code keeps that country's clock: JCEX files its Hong Kong hub's rows under
  the destination with the destination's offset. An offset the place does not keep at that
  time, and a place without one clock, keep the wall clock.
- The newest scan's instant, when it has one, is the last update, and a delivered scan's is the
  delivery time. Rows dated after the read are dropped.
- The recipient's province, city and postcode, the shipment's reference and the delivery
  estimate are never read.

## Limitations

- No delivery estimate, service, sender, recipient or proof of delivery.
- The delivering partner and its number are not named: the reply leaves them empty.
- Other JCEX number layouts are not looked up until one is seen.

## Numbers

ParcelPanel's JCEX page offers a waybill of `JCZ`, ten digits and `DH`, and JCEX's tracker
answers it. `jcex-1` claims that layout.

## Testing

`JCEX_TRACKING_NUMBER=... JCEX_UNKNOWN_NUMBER=... npm run test:carriers:live -- carriers/jcex`
