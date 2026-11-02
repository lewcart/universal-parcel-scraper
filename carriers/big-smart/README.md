# Big Smart

Big Smart parcels use enabled universal providers. There is no dedicated adapter.

## Retrieval

The public tracker calls `GET https://api.bigsmart.mx/api/order-logs/{number}` with
`populate=true` and `language`. It requires the shared visitor bearer embedded in the
tracker's script, without an account or cookie. The service does not retain every archived
parcel; archived histories do not establish current availability.

## Numbers

Big Smart is a Mexican last-mile and middle-mile delivery company; its Big Pack service
delivers e-commerce parcels the same or next day. Archived replies of its tracking API give
each parcel a Big Smart tracking number, mostly of 16 digits. The tracker also finds a parcel
by an alternative tracking number from the shipper's system, such as MXFDD followed by digits.

No rule claims Big Smart numbers. The tracking numbers carry no prefix and fall inside other
carriers' all-digit shapes, and alternative numbers take each shipper's own shape.

## Links

One parcel opens on bigsmart.mx under `/tracking/` or `/en/tracking/` with the number in the
`trackingNumber` parameter. The tracker looks the number up when the page loads, and the
library reads the number from that parameter.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
