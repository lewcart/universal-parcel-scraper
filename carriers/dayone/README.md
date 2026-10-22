# DayOne

DayOne is a cross-border fulfilment warehouse whose tracker is dayonetrack.com. It says it is
not a delivery carrier: it ships merchants' orders and its parcels reach the destination
country's courier. DayOne parcels use enabled universal providers; there is no dedicated
adapter yet.

## Numbers

Its numbers are DOT and sixteen digits. The tracker sends those with DOT0 and DOT1 to its two
lookups, a sample on ParcelPanel's DayOne page and a parcel the tracker answered share the
layout, and no other carrier's rule takes it, so `dayone-1` has high confidence.

## Links

`www.dayonetrack.com/track?trackNo=` followed by the number opens a parcel.

## Adapter lead

The tracker's script asks two lookups without a cookie or account:

- A number with DOT0: `GET /api/webservice/Service.ashx` on the tracker's own host, with
  `method=track`, `param` set to `{"sp":"","nums":[…]}` and `key` set to the Base64 of that
  text's MD5 in hexadecimal, as JSONP (`callbackparam`). The reply's `data` has one entry per
  number with `server_hawbcode` the number, a last-mile `channel_hawbcode`, the destination
  country, a status code, and scans with `track_occur_date`, `track_code`, English and Chinese
  wording and a `gmt_offset`.
- A number with DOT1: `GET https://erp.dayoneerp.com/dayone-api/queryTrackingInfo?id=…`.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
