# Polaris Transportation Group

Polaris Transportation Group shipments use enabled universal providers. There is no dedicated
adapter.

## Numbers

Polaris tracks cross-border less-than-truckload freight by its PRO number, a `P` followed by
seven digits in lookups archived from its own trace page. The page's script treats a PRO
starting with `P` as Polaris's own and drops leading zeros and spaces before asking its
tracing service, and its help text warns that the numbers use zero, never the letter O.
`polaris-transport-1` suggests the `P` layout with low confidence, since GLS's eight-character
rules accept the same shape.

## Links

The trace page opens one shipment at `polaristransport.com/en/trace-polaris.php` with the
number in `pro`, as did the former quick trace page; the French page takes the same parameter.
The former quick trace page showed each PRO in a frame from the bill viewer on
`customer.polaristransport.com`, which takes it as `search_value`. The library reads the number
from each.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
