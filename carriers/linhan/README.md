# LinHan International

LinHan International (深圳市林瀚国际物流有限公司, LinHan on 17TRACK) is a Shenzhen forwarder that
flies cross-border e-commerce parcels out of China and hands them to an agent at the
destination. Tracked through the lookup its tracking page makes.

## How it works

1. `direct`: one `GET https://www.linhan56.com/index/tracknumber/getTrackingByNos?nos={number}`,
   as the tracking page `index/tracknumber/track?nos={number}` sends it on load. It needs no
   cookie, token, key or browser. The reply is a JSON array, served as HTML, with an item per
   number asked: the summary's status and the countries in Chinese, and the scans in English,
   newest first.
2. `retry`: one more request after a network failure or a timeout. The first gets half of the
   budget.

- Only the item whose number is the whole waybill asked is read; a reply without it is a
  schema failure.
- The adapter asks in Chinese, the page's language, with `Accept-Language: zh-CN`. The tracker
  fails with HTTP 500 for the `*` Node's fetch sends by default.
- An unknown number is HTTP 200 with the status "查询不到" and no scans. Only that answer is not
  found. A redirect or a 404 is a moved route, a browser check in place of the reply is a
  challenge, and any other reply that is not the expected JSON is a schema failure.

## Notes

- The tracker is the same system as [CTTYEX's](../cttyex/README.md), on LinHan's own domain.
  LinHan's history goes on past the flight out of China, through the destination agent's
  customs clearance to the delivery.
- Scan clocks are wall clocks to the second without a zone. LinHan's own steps in China, from
  the order data to the flight out, are read on Beijing time: China keeps one zone. The rows
  abroad keep their wall clocks in `local_time`. One has come with a clock still ahead of the
  destination's when it was read, so they are not all on the destination's clock, and nothing
  tells which they keep. The tracker's order stands, and the newest scan's instant, when it has
  one, is the last update.
- Rows at the destination open with the town, and the delivery with the postcode too: "Town,
  00000, Delivered". One names the town after its verb: "Arrive Town, at the sorting and
  distribution center". The town becomes the location so the wording stays the same from town
  to town; the postcode is dropped.
- The tracker has no codes. [`status.ts`](status.ts) stages the scans by their wording, and
  other wording goes through the shared rules. The newest staged scan decides the parcel's
  stage, and the summary's status only when no scan has one.
- The destination's Chinese name becomes a country code where it names a country, and is kept
  as written otherwise.

## Limitations

- No delivery estimate, weight, service, delivery partner or partner number.
- The tracker shows parcels from the last two months.

## Numbers

LinHan's waybills are LHGJ, eight digits and CD: LH for 林瀚 and GJ for 国际, as in JHGJ,
Jiuhao International's name on 17TRACK. No other carrier's rule takes the shape, so the rule
has high confidence and no recognition is declared. The adapter takes nothing else. The
samples and their sources are in [`numbers.json`](numbers.json).

## Links

`www.linhan56.com/index/tracknumber/track?nos={number}` opens one parcel on the carrier's
tracker, which looks the number up on load.

## Testing

`npm run test:carriers:live -- carriers/linhan`, with `LINHAN_TRACKING_NUMBER` and optionally
`LINHAN_UNKNOWN_NUMBER` set outside the repository.
