# JS Express

JS Express (急速国际), run by 急创速供应链管理（苏州）有限公司, ships parcels abroad from China
for online shops, through dedicated lines, express and postal services, and a local carrier
delivers them. Tracked through the form on its home page.

## How it works

1. `direct`: one `POST https://www.js-exp.com/index.php?page=19` with the form body
   `card_num={number}`, as the tracking form on js-exp.com's home page sends it. It needs no
   cookie, token, captcha or browser. The page comes back rendered on the server, with the
   number in the form and the scans below it.
2. `retry`: a lookup that fails to reach the tracker, or hangs, is sent once more within the
   budget. The first try gets half of the budget.

- An unknown number gets "未获取到任何数据,请提供有效单号!" in place of the scans, which is not
  found. "暂无轨迹数据", the page script's wording for a known waybill without scans, has no
  history. An empty answer is inconclusive. A 403, a Cloudflare check or a captcha prompt in
  place of the answer is a challenge. A 404 or a redirect is a moved route.
- The page must echo the whole requested number. The tracker matches whole numbers only.
- Recognition makes the same request.

## Notes

- The tracking page's own query button posts to `index.php?c=test` and asks for an image
  captcha first, then lets the browser skip it for four hours. The home page's form reaches the
  same scans without it, so the adapter uses the form.
- A row is a clock, a place in `【…】` and a wording. Clocks are wall clocks to the second, with
  no zone, and one history mixes China's with the airports' and the destination courier's, so
  the page's order stands.
- A row at a place in mainland China, named for the country, a region such as South China, a
  province or a city, is on Beijing time. A flight's departure filed there keeps its wall clock:
  one has come hours after its flight could have left, given the landing that followed.
- In a history that names Straightship, its rows, those that name it and those whose wording
  ends with a town and a Canadian province, are on UTC, the clock of Straightship's own page.
  Straightship's record of the parcel's data comes within a minute of the Chinese warehouse's
  inbound scan only when the one is read on UTC and the other on Beijing time, and its
  deliveries then come before the 9 pm its round promises.
- Rows at an airport's code or without a place keep `local_time`, as do other couriers' rows:
  iMile's name no country. The newest row's instant, when it has one, is the last update, and a
  dated delivery's is the delivery time.
- JS Express's own rows and its partners' share the history in their partners' words. A
  destination courier's wording repeats the place with its province, as "Delivered (Sample Town,
  ON)": the adapter moves it into the location, so the wording stays the same from town to town.
- Partners' records of the parcel's data and a courier's delivery forecast move nothing and have
  no stage.
- A delivery loses a clause naming who took the parcel, and every row loses phone numbers.

## Limitations

- The page has no summary, ETA, weight, service, destination or the delivering courier's own
  number.

## Numbers

JS Express waybills are `JSE`, two capital letters, ten digits and `YQ`, the layout 17FEIA,
WanbExpress, SFC and CJ Packet use with prefixes of their own. The `JSE` prefix is JS
Express's own, so `js-express-1` claims the layout and the adapter takes nothing else. The
samples and their sources are in [`numbers.json`](numbers.json).

## Testing

`npm run test:carriers:live -- carriers/js-express`, with `JS_EXPRESS_TRACKING_NUMBER` set
outside the repository. Optionally set `JS_EXPRESS_DELIVERED_NUMBER` to check a delivered
waybill and `JS_EXPRESS_UNKNOWN_NUMBER` to check a number the tracker does not know.
