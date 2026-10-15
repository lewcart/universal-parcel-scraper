# eCourier

eCourier parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

eCourier IDs are `ECR` followed by digits; eCourier's merchant API documentation shows ten,
thirteen and sixteen digits, and `ecourier-1` claims that layout. The tracking page also takes
IDs that start with `BL`. No example of those has been published, so no rule covers them.

## Links

The tracking forms on ecourier.com.bd open `ecourier.com.bd/tracking?tracking_no={number}`.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
