# Pargo

Pargo is a pickup-point network in South Africa; couriers carry its parcels to
those points. Enabled universal providers retrieve its histories.

## Retrieval

The marketing page embeds the [public tracker](https://track.pargo.co.za/). Its
client sends `GET /events/orders/{code}` on that same host without a session or
credential. The widget expects `orderData.trackingCode`, current status, reached steps and
event history, separate from address and pickup details.

The lookup can return HTTP 422 with a `validation_error` naming the complete
reference. Archived references receive the same unavailable-order response as an
unknown code. Native retrieval remains disabled until a retained positive proves
identity, history and clocks.

## Links

The standalone tracker reads `code` from its query. Older marketing and PHP
tracking routes remain ingestion leads; the current marketing iframe does not
inherit their query parameters.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
