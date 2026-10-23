# Pitney Bowes

Pitney Bowes Global Ecommerce carries eBay's Global Shipping Program parcels and other
cross-border parcels through its hubs, under the Pitney Bowes Expedited Parcel Service, and
hands them to a carrier or post in the destination country. Its US ecommerce business was wound
down in 2024 and current parcels pass through its UK hub. Tracked through the lookup its
tracking page makes.

## How it works

1. `direct`: one `GET https://trackpb.shipment.co/api/track/package-details/{number}` with the
   header `X-BRAND-ID: RALVsUZS`, as the tracking page's script sends it. The header names the
   tracker's brand on Pitney Bowes's tracking platform; the page reads it from its public
   configuration, and every visitor sends the same. It needs no cookie, token or browser. The
   JSON reply has a summary status, the shipping service, the weight and the scans the page
   lists, newest first.
2. `retry`: one more try when the request fails to reach the tracker or hangs. The first try
   gets half of the budget.

- The tracker has no not-found answer. A number it does not know, a history it no longer
  keeps and a failed lookup all get HTTP 200 with the status `ServerError` and no scans, which
  the page shows as a temporary problem. The adapter reports it as inconclusive. The
  platform's own `NotFound` status is not found.
- A lookup without the brand header is a 400. A brand the platform does not know is a 404, as
  is a moved route.
- The reply must name the number asked.
- There is no recognition, since an unknown number gets no clean answer.

## Notes

- Each scan's `date` and `hour` are the wall clock it came with, to the minute, with no zone.
  The hub's scans are UK time, but the scans relayed from the destination carrier keep that
  carrier's clock, so every scan stays `local_time`.
- Some partners' scans come twice: once with the place, on its clock, and once in capitals
  without the place, a whole number of hours away (UTC in the scans seen). The copy without the
  place is dropped, as is a scan repeated whole. A relayed place's `XX` for a missing region
  is dropped too.
- Scans carry no code. The map reads Pitney Bowes's own wording and the postal wording it
  relays; other relayed wording falls to the shared rules. Export paperwork written at the hub
  ("Customs Documentation and Labeling") is not customs, and the onward carrier opening its
  record moves nothing. Interpost's import clearance comes as `B2C ClearanceStatus` and a
  status number; Interpost's own tracker captions 4 as cleared, so only that number is mapped.
- The summary's `Delivered` settles a delivery. Its other statuses stand in only when no scan
  has a stage: a reply has marked a parcel its addressee collected as `DeliveryException`.
- Relayed scans link to the onward carrier's page through a URL that carries an access key and
  that carrier's number. Neither is kept, so there is no hand-off.
- The weight comes in pounds and ounces and is kept in kilograms. The page does not show it.

## Limitations

- No delivery estimate, provider codes, or delivery time as an instant.
- A number the tracker does not know cannot be told from an outage or a history it no longer
  keeps.

## Numbers

Pitney Bowes's own references start with fixed prefixes: `UPAA`, a letter and fifteen digits on
eBay parcels from the US and the UK; `UPBE` and sixteen hexadecimal characters on eBay parcels
from the UK; and `PBX`, two letters and nine digits or fifteen hexadecimal characters on other
cross-border parcels. Archived replies of its trackers show all three. No other carrier prints
these prefixes, so `pitney-bowes-1` to `pitney-bowes-3` claim them, and the adapter takes only
these shapes. A parcel that the destination carrier or USPS also numbers keeps that number with
that carrier's rules.

## Links

The tracker at `trackpb.shipment.co` opens one parcel at `/track/{number}`, the deep link
Pitney Bowes's shipping API documentation gives, and also reads the number from `number` on
`/track`. Older links on `parceltracking.pb.com` carry the number as the path; that host no
longer answers.

## Testing

`npm run test:carriers:live -- carriers/pitney-bowes`, with `PITNEY_BOWES_TRACKING_NUMBER` and
optionally `PITNEY_BOWES_UNKNOWN_NUMBER` set outside the repository. The unknown number's
lookup is expected to be inconclusive.
