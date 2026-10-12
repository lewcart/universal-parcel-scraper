# Day & Ross

Day & Ross shipments use enabled universal providers. There is no dedicated adapter.

## Numbers

Day & Ross shipment numbers are three letters and seven digits: parcel numbers start `SML`, and
LTL and truckload numbers start `MTN`. `day-ross-1` suggests Day & Ross for those prefixes at
low confidence, because aggregator samples are the only source. Shipments booked in Day & Ross's
current order system have other numbers: the tracking page's example is an `A` followed by
digits, and no rule covers them yet.

## Why there is no adapter

Every page on `dayross.com`, including the tracker at `/track-shipments`, sits behind a
Cloudflare challenge. HTTP clients get the challenge page with HTTP 403, and a fresh browser is
asked to tick "Verify you are human".

The tracker reads Day & Ross's order API on `ece.dayrossgroup.com`, which has no challenge.
`TruckMateAPI/api/ManageOrders/TrackOrders?ShipmentNumbers=` searches numbers and
`GetOrderById?probillNumber=` returns the scans; shipments from the previous system are read
from `ShippingAPI/v1.1/Shipments/{division}/summary`. Each call needs a guest bearer token that
the site's Sitecore layout service (`/sitecore/api/layout/render/jss`) puts in every visitor's
page, and that service is behind the same challenge. Without the token the API answers 401.
The one anonymous read, `GetOrderByBillNumber?billNumber=`, answers "No Order found" for an
unknown number and a server error for a number it finds, so it shows that an order exists but
returns no history.

Day & Ross has no customer app on Google Play, and its former SOAP service on
`dayross.dayrossgroup.com` is gone.

## Testing

Provider live-test inputs and commands are in the [provider READMEs](../../providers/README.md).
