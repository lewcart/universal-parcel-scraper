# Asyad Express

Asyad Express parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Asyad Express runs Oman's parcel and express tracking for the national postal group, Oman Post.
Its shipment numbers seen so far are plain digits with no documented length or prefix, so no
rule claims them. International postal items keep the UPU format and are left to generic
postal detection.

## Links

The tracker, `asyadexpress.om/track-trace`, takes the number as a path segment and accepts
up to ten numbers. Older Oman Post links use `omanpost.om/Tracking/` with `trackingno`.

## Why there is no adapter

The tracker renders a shipment's events on its server for a plain `GET` of the link above,
without an account, token or captcha, as archived lookups show. Asyad Express's app reads the
same history from `apix.asyadexpress.com/v1/customer/order/{number}/ultimate-history` with a key
it ships to every install, and asks an Oman Post lookup on `poboxes.omanpost.om` for a number
that API does not hold. None of these hosts, nor `omanpost.om`, answers connections from outside
Oman: from Europe, the Americas, Asia and the other Gulf states the connection times out, while
an Omani network gets the tracker. So Asyad Express stays on universal providers.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
