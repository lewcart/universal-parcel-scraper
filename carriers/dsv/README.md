# DSV

DSV and former DB Schenker shipments use enabled universal providers. There is no dedicated adapter.

## Numbers

DSV and DB Schenker publish no shape. Aggregator samples range from references that start with
an airport code to sixteen- and twenty-digit numbers, so no rule claims them.

## Links

The tracking form on `dsv.com` sends the number to `mydsv.com/track-shipment?query={number}`.
Former DB Schenker shipments have their own form on `dsv.com/mydsv/tracking-public`.

## Testing

Provider live-test inputs and commands are in the [provider READMEs](../../providers/README.md).
