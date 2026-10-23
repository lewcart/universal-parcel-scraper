# CTTYEX

CTTYEX (深圳诚泰通运国际物流, Shenzhen Chengtai Tongyun) is a Shenzhen forwarder of
cross-border e-commerce parcels from China. Tracked through the lookup its tracking page makes.

## How it works

1. `direct`: one `GET https://www.cttyvip888.com/index/tracknumber/getTrackingByNos?nos={number}`,
   as the tracking page's script sends it on load. It needs no cookie, token, key or browser.
   The reply is a JSON array, served as HTML, with an item per number asked: the summary's status
   in Chinese, the origin and destination countries in Chinese, and the scans in English, newest
   first.
2. `retry`: one more request after a network failure or a timeout. The first gets half of the
   budget.

- The tracker matches the whole number in capitals, so the adapter sends it in capitals, and the
  item must echo it.
- The adapter asks in Chinese, the page's language, with `Accept-Language: zh-CN`. The tracker
  fails with HTTP 500 for the `*` Node's fetch sends by default, and words the summary and the
  countries in English only for exactly `en`.
- An unknown number is HTTP 200 with the status "查询不到" ("Not Found" in English) and no scans.
  Only that answer is not found. A lookup without a number gets `{"success":false}`, which is
  inconclusive.
- A redirect or a 404 is a moved route. A browser check in place of the reply is a challenge, and
  any other reply that is not the expected JSON is a schema failure.
- Recognition makes the same request.

## Notes

- The tracker shows CTTYEX's own steps in China, from the order data to the departure from the
  origin airport, then the destination agent's and the last-mile network's steps, worded as on
  [LinHan's](../linhan/README.md) tracker, the same system: the arrival, the import clearance, the
  processing and sorting centers. Scans print a wall clock to the second without a zone. China
  keeps one zone, so a step in China is an instant on Beijing time. Any other row keeps its wall
  clock: LinHan's tracker writes its rows abroad on Beijing time too, but no CTTYEX row abroad
  has yet come beside a clock that tells its zone. [`identity.ts`](identity.ts) lets a wording the
  map comes to list as a step in China take over the row an app stored from its wall clock.
- The tracker has no codes. [`status.ts`](status.ts) stages the scans by their wording; others go
  through the shared wording rules. The last-mile network's "Accepted at … Regional Destination
  Facility" is in transit: CTTYEX took the parcel in China. The newest staged scan decides the parcel's stage, and the
  summary's status only when no scan has one: a status such as "运输途中" (in transit) says less
  than the scans.
- The destination's Chinese name becomes a country code where it names a country, and is kept as
  written otherwise.

## Limitations

- No location, delivery estimate, weight, delivery partner or partner number.
- A row abroad keeps the town, state and ZIP code that open it in its wording.
- The tracker keeps parcels for two months.

## Numbers

Its tracking numbers are CTTY, ten digits and CN, CTTY standing for Chengtai Tongyun. The shape
is fixed and no other carrier's rule takes it, so the rule has high confidence. No public
number has been found, so the corpus holds a synthetic one.

## Links

`www.cttyvip888.com/index/tracknumber/track?nos={number}` opens one parcel on the carrier's
tracker, which looks the number up on load.

## Testing

`npm run test:carriers:live -- carriers/cttyex`, with `CTTYEX_TRACKING_NUMBER` and optionally
`CTTYEX_UNKNOWN_NUMBER` set outside the repository.
