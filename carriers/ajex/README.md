# AJEX

AJEX parcels use enabled universal providers. There is no dedicated adapter.

AJEX Logistics Services is a Saudi express and e-commerce delivery company that also serves
the UAE and Bahrain.

## Numbers

The tracker accepts fifteen characters for numbers containing `AJ` and eleven otherwise.
Archived lookups show `AJA` or `AJS` followed by twelve digits, which `ajex-1` claims; no other
carrier's numbers or rules use that shape. Recent lookups also show `A` followed by ten digits;
GLS Italy's depot numbers share that shape, so no rule claims it.

## Links

The tracking box opens `aj-ex.com/shipment-status/{number}`, also under `/ar/`; older pages
used `aj-ex.com/tracking?tracking_number={number}`. The library reads the number from either
address.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
