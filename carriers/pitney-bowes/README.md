# Pitney Bowes

Pitney Bowes parcels use enabled universal providers. There is no dedicated adapter.

Pitney Bowes Global Ecommerce carries eBay's Global Shipping Program parcels and other
cross-border parcels through its hubs, under the Pitney Bowes Expedited Parcel Service, and
hands them to a carrier or post in the destination country. Its US ecommerce business was wound
down in 2024 and current parcels pass through its UK hub, so offset-less scans read in UK time.

## Numbers

Pitney Bowes's own references start with fixed prefixes: `UPAA`, a letter and fifteen digits on
eBay parcels from the US and the UK; `UPBE` and sixteen hexadecimal characters on eBay parcels
from the UK; and `PBX`, two letters and nine digits or fifteen hexadecimal characters on other
cross-border parcels. Archived replies of its trackers show all three. No other carrier prints
these prefixes, so `pitney-bowes-1` to `pitney-bowes-3` claim them. A parcel that the
destination carrier or USPS also numbers keeps that number with that carrier's rules.

## Links

The tracker at `trackpb.shipment.co` opens one parcel at `/track/{number}`, the deep link
Pitney Bowes's shipping API documentation gives, and also reads the number from `number` on
`/track`. Older links on `parceltracking.pb.com` carry the number as the path; that host no
longer answers.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
