# Straightship

Straightship parcels use enabled universal providers. There is no dedicated adapter.

Straightship is a Burnaby, BC cross-border parcel company that ships from China to North
America and delivers the last mile in Canada with its own fleet and local courier partners.
Its tracker shows scans at its own stations in British Columbia, Alberta and Ontario.

## Numbers

Straightship numbers start with `STRTD` or `STRCA` followed by digits; `straightship-1` claims
the lengths archived lookups show. A client's own `STSHYW` layout was seen once and stays
unclaimed.

## Notes

The tracker shows every scan in UTC and says so under the history.

## Links

The tracking form opens `straightship.com/track-your-shipment/tracking-id/{number}/`; the
library reads the number from that path.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
