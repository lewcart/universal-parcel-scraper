# APC Postal Logistics

APC Postal Logistics parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Lookups archived from APC's own tracker show four layouts: five digits, `P`, a six-digit date
and ten digits; five digits, `A` and nine or ten digits; and sixteen digits. A Trustpilot
review and TrackingMore's APC page add sixteen-digit numbers, `PF` and thirteen digits, and
ten digits.

`apc-postal-logistics-1` claims the `P` layout and `apc-postal-logistics-2` the `A` layout,
whose ten-digit form also fits Royal Mail's broad hexadecimal shape. Sixteen and ten digits
are shared by many carriers, and the `PF` layout has only aggregator samples, so no rule
claims them.

## Links

APC's tracker opens one parcel at `tracking.apc-pli.com/` followed by the number.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
