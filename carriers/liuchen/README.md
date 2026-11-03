# Liuchen

Liuchen is a Shenzhen forwarder shipping parcels from China to Latin America. Its site is liuchenwl.com.
Tracked through the lookup its tracking page makes.

## How it works

1. `direct`: one `GET https://www.liuchenwl.com/index/tracknumber/getTrackingByNos?nos={number}`,
   as the tracking page `index/tracknumber/track?nos={number}` sends it on load. It needs no
   cookie, key, CAPTCHA or browser.
2. `retry`: one more request after a network failure or a timeout. The first gets half of the
   budget.

- The tracker is [CTTYEX's](../cttyex/README.md) system, as [Jifan's](../jifan/README.md) and
  [LinHan's](../linhan/README.md) are, and the adapter reads its reply with CTTYEX's parser: a JSON
  array, served as HTML, with an item per number asked, holding the summary's status and the
  countries in Chinese and the scans in English, newest first. The item must echo the whole number
  in capitals.
- An unknown number is HTTP 200 with the status "查询不到" and no scans. Only that answer is not
  found. A redirect or a 404 is a moved route, a browser check in place of the reply is a
  challenge, and any other reply that is not the expected JSON is a schema failure.

## Notes

- The scans a universal provider relays from Liuchen are worded as on CTTYEX's tracker, from the
  order data to the arrival at the destination airport, and staged by CTTYEX's map. Every row is a
  wall clock on Beijing time.
- The destination's Chinese name becomes a country code where it names a country.

## Numbers

A parcel a universal provider reported from Liuchen was numbered `LCWL`, the initials of 六尘物流,
eight digits and `YQ`, the way its sister tenants put their own initials first (Jifan's `JFGJ`,
LinHan's `LHGJ`). With that one parcel and no public number, the rule offering Liuchen for that
layout is low, and recognition asks the tracker about it. The adapter takes any number of eight or
more letters and digits: other numbers reach it when they are filed under Liuchen or opened from its
tracking link.

## Links

The tracker opens numbers from its `nos` parameter.

## Testing

`npm run test:carriers:live -- carriers/liuchen`, with `LIUCHEN_TRACKING_NUMBER` and optionally
`LIUCHEN_UNKNOWN_NUMBER` set outside the repository.
