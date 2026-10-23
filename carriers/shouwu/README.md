# Shouwu International

Shouwu International is 上海守务国际, a Shanghai cross-border forwarder. Universal providers name
it SWE. The adapter reads the lookup its tracking page asks.

## Numbers

Its waybills are SWECN, twelve digits and YQ. The twelve digits open with the date. A parcel a
universal provider filed under SWE has that layout and Shouwu's own tracker answers it, and no
other carrier's rule takes it, so `shouwu-1` has high confidence.

## Retrieval

The tracking page's script asks `POST
https://admin.shshouwu.com/api/freight/order/PubOrder/getOrderTrace` with `{"strs":[number]}`,
without a cookie, account or CAPTCHA, and the adapter sends the same request. One HTTP read, and
one more when the first fails to connect or hangs. Recognition makes the same lookup for the
numbers `shouwu-1` offers.

## Notes

- The lookup answers with HTTP 200 and `{"result":{"code":0},"data":[…]}`, one entry per parcel
  it has under the numbers asked. A number without an entry is what the page shows as not
  found, and the only not-found. Another code, as for a request it cannot read, is
  inconclusive; a redirect, a 404, a browser check or a reply that is not JSON is never read as
  a missing parcel.
- Only entries whose `order.orderNo` is the whole number asked are read. A reply naming another
  number only is inconclusive. The page lists every entry under a number; of two, the one with
  the newest scan is read.
- `order.traceStatus` is one of four codes the page labels Preparing, In Transit, Undelivered
  and Delivered. It decides the stage, as on the page. The page explains Preparing as a parcel
  at the warehouse and In Transit as anything from the handover to delivery in the destination
  country, so the newest staged scan refines a status within what it covers. A status without
  scans is a summary. Scans have no code; their wording is staged by the shared rules.
- `traceTime` is epoch seconds, which the page shows in the visitor's zone without naming one,
  so each scan keeps its instant. The page reads the first ten digits, so the adapter reads
  milliseconds as the same second.
- A scan's place is `traceLocation`, which the page leaves out and Shouwu's own back office shows
  before the wording. Anything with a digit, as an address or a postcode has, is dropped.
- The destination is `order.countryCodeTwo`. The scan's leg (`traceType`), the status text
  (`traceStatusDesc`) and the destination's name are not read.
- The request carries the page's `x-locale`, `zh-cn` unless a visitor chose another language.

## Limitations

- No estimate, weight, service, last-mile carrier or last-mile number: the page shows none.
- A delivery is dated only by a scan whose wording reads as one.

## Links

`admin.shshouwu.com/track.html?q=` followed by the number opens a parcel. The customer portal on
sedel.com sends its tracking box there.

## Testing

Set `SHOUWU_TRACKING_NUMBER` to a waybill and optionally `SHOUWU_UNKNOWN_NUMBER` outside the
repository, then run `npm run test:carriers:live -- carriers/shouwu`.
