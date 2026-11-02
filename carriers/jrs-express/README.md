# JRS Express

JRS Express parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

A JRS Express shipment is identified by the airbill number on its official receipt, usually six
digits, together with the receipt's branch code (BC) of three or four digits. The former
tracker took the two in separate fields; the current one takes them in one field joined by a
hyphen. Neither part is distinctive, so there is no detection rule.

## Tracker

The tracking page reads `GET https://jrs-core-api.azurewebsites.net/api/Tracking/v1/track-airbill?airbill={number}`
without a session or key. It answers a JSON list of scans, each with a status text, a branch and a
time, and an empty list for a number it does not know, such as the archived sample. No adapter uses
it yet: without a current public receipt number there is no found reply to show how it names the
whole branch code and airbill number, and an answer has to be bound to that whole number.

## Links

The library reads a number from the `or` query parameter of `/track` on `jrs-express.com` and
`www.jrs-express.com`.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
