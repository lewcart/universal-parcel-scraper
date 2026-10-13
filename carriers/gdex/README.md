# GDEX

GD Express (GDEX) parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

GDEX consignment numbers are ten digits or `MY` and eleven digits, as lookups archived from
GDEX's e-tracking page show. `gdex-1` claims the `MY` layout. Ten digits are also DHL Express
waybills and other carriers' numbers, so no rule claims them.

## Links

GDEX's former e-tracking page took the number as `capture` on
`web2.gdexpress.com/official/iframe/etracking_v2.php`, and the library reads it from such
addresses. The current tracking page sits behind a bot check, so the library builds no address.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
