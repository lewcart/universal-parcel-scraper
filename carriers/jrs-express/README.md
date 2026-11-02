# JRS Express

JRS Express parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

A JRS Express shipment is identified by the airbill number on its official receipt, usually six
digits, together with the receipt's branch code (BC) of three or four digits. The former
tracker took the two in separate fields; the current one takes them in one field joined by a
hyphen. Neither part is distinctive, so there is no detection rule.

## Why there is no adapter

The tracking page reads `GET https://jrs-core-api.azurewebsites.net/api/Tracking/v1/track-airbill?airbill={number}`
without a session or key. It answers a JSON list of scans, each with a status text, a branch and a
time, and an empty list for a number it does not know, such as the archived sample. It matches a
reference loosely and can return another person's shipment for a number that is not theirs, so no
adapter reads it, and numbers are never tried against it to learn its replies.

## Links

The library reads a number from the `or` query parameter of `/track` on `jrs-express.com` and
`www.jrs-express.com`.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
