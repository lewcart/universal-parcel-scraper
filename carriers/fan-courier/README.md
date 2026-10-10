# FAN Courier

Romanian FAN Courier parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Every AWB found has thirteen digits: in FAN Courier's API 2.0 documentation, in an
open-source client and in lookups archived from its tracker. They start with `2`, `4` or
`7000`, but FAN publishes no length, prefix or check-digit rule. Thirteen digits are shared
with several posts and couriers, so no rule claims them and the user picks FAN Courier.

## Links

FAN Courier's tracker writes the AWB into its address as `?tracking={number}` and renders
that number back when the page loads. Older links put the AWB in `awb` or in the path.

## Testing

Provider live-test inputs and commands are in the [provider READMEs](../../providers/README.md).
