# JRS Express

JRS Express parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

A JRS Express shipment is identified by the airbill number on its official receipt, usually six
digits, together with the receipt's branch code (BC) of three or four digits. The former
tracker took the two in separate fields; the current one takes them in one field, the airbill
first and the branch code after a hyphen. Neither part is distinctive, so there is no detection
rule.

## Why there is no adapter

The tracking page reads `GET https://jrs-core-api.azurewebsites.net/api/Tracking/v1/track-airbill?airbill={airbill}-{branch}`
without a session, key or challenge. It answers a JSON list of scans, each naming its airbill
(`trackingID`) and branch code (`trackingCode`), with a status text, a branch and a UTC time that
the page shows on Manila's clock. Both parts must match: another branch code for the same airbill,
a malformed reference and the archived sample all get an empty list.

The library hands adapters the number without its hyphen, and airbills and branch codes vary in
length, so an adapter could not tell where the airbill ends. A wrong split asks for a reference
that can be another shipment's, which the tracker would then answer in full, recipient included.
An adapter needs the reference with its hyphen, or the branch code as its own field.

## Links

The library reads a number from the `or` query parameter of `/track` on `jrs-express.com` and
`www.jrs-express.com`.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
