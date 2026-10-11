# DPD Ireland

DPD Ireland's consignments, through its public tracker on `tracking.dpd.ie`. The group adapter
[dpd](../dpd/README.md) reads DPD Switzerland's tracker and fourteen-digit parcel numbers;
DPD Ireland's tracker answers for its own consignment numbers.

## How it works

1. `direct`: a GET of `https://tracking.dpd.ie/?deviceType=5&consignmentNumber={number}`
   stores the number in a new anonymous ASP.NET session (`ASP.NET_SessionId`, with Cloudflare's
   `__cf_bm`) and redirects to `/Home/SearchResult?deviceType=5`. A GET of that page with the
   session cookie returns the consignment. No account, postcode or CAPTCHA is needed, and each
   lookup opens its own session.
2. `retry`: one more try, with a new session, when a request fails to reach DPD Ireland or
   hangs. The first try gets half of the budget.

- The result page names the consignment; it must be the requested number, otherwise
  `SchemaError`.
- For a consignment it does not have, the result page redirects to the tracker's error page,
  which says it could not locate the consignment number: `NotFoundError`. Any other redirect,
  an error page without that notice, a 404 or a page without a consignment is inconclusive, and
  Cloudflare's challenge page is `ChallengeError`.
- Recognition makes the same lookup; the not-found notice is the only unknown answer.
- DPD Ireland's mobile app shows the same tracker in a web view; its own API needs an account.

## Notes

- Scans are listed oldest first. A consignment of several parcels repeats each scan once per
  parcel; identical rows are kept once.
- Times have no offset. The tracker's server keeps Irish time, so a scan at a DPD Ireland
  depot ("Dpd" and the depot's name), at Head Office or on the website is read in Irish time.
  Another network's scan names its town and country and keeps its wall clock.
- Head Office and Web are DPD Ireland's systems rather than places, so they give no location.
- The history cuts the van scan's delivery window short, and the wording is kept without it.
  While the van scan is the newest, the headline's whole window gives `expected_delivery_from`
  and `expected_delivery` on the van scan's day.
- The wording is mapped whole in [status.ts](status.ts). A driver's collection accepts the
  parcel unless an earlier scan already did or moved it. A Pickup shop's hand-over is DPD's
  collection, in transit, after the sender dropped the parcel at the shop; otherwise it may be
  the recipient's collection and keeps the stage before it. A rescheduled delivery keeps the
  stage before it too. The `statusMap` lists the reschedule as an intentional gap and answers
  unknown for the collections.

## Numbers

DPD Ireland's tracker takes a consignment number. Lookups archived from it show nine digits in
nearly every case, and ten digits twice, once on the former QuickTrack page; the adapter takes
both. DPD Ireland publishes no check digit, and nine and ten digits are shared with TNT, DHL
and several other carriers, so no rule claims them and the user picks DPD Ireland. None of the
archived lookups uses the fourteen-digit parcel number of the other DPD networks.

## Links

DPD Ireland's tracking forms send the number as `consignmentNumber` to `www.dpd.ie/tracking/`,
which shows the result from `tracking.dpd.ie` in a frame. Lookups archived from `dpd.ie` carry
the same parameter in the address, so `www.dpd.ie/tracking/?consignmentNumber={number}` opens
one consignment.

## Limitations

- The error page that answers an unknown consignment is the tracker's general error page. A
  failure behind the result page that ends there with the same notice reads as not found.
- The tracker keeps about six months of consignments.
- Cloudflare guards the tracker. It has answered Node's HTTP/1.1 client with its challenge page
  for hours from some networks, while HTTP/2 and curl passed. Cheerio's `undici` makes itself
  Node's fetch dispatcher, which uses HTTP/1.1, when it loads before the process's first fetch.
  The adapter reports the challenge page as a challenge.
- The page shows no weight or sender. The parcel count is not kept, and recipient details are
  not on the page.

## Testing

```sh
DPD_IE_TRACKING_NUMBER=... DPD_IE_UNKNOWN_NUMBER=... npm run test:carriers:live -- carriers/dpd-ie
```
