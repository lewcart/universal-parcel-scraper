# A&B Courier

A&B Courier parcels use enabled universal providers. There is no dedicated adapter.

A&B Courier Service is a courier and freight company in Toronto and York Region, with
same-day, rush and overnight courier service in the Greater Toronto Area.

## Numbers

The tracker takes A&B's order number, which is a plain run of digits; archived lookups show
seven-digit orders. The tracking app reads the input as a whole number, so leading zeros are
lost. A bare seven-digit number fits many carriers' references, so no rule claims it.

## Links

The tracking form on `abcourier.com` opens
`abcourier.com/CCWebClient/General/TrackingInfo/{number}`. Archived lookups also use the older
page `abcourier.com/tracking-info?tracking-number={number}`; the library reads the number from
either address.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
