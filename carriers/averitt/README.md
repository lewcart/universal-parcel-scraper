# Averitt Express

Averitt Express freight shipments use enabled universal providers. There is no dedicated
adapter.

## Numbers

Averitt PRO numbers are ten digits, leading zeros included, as Averitt's API guide and its
embedded-tracking page state. Its API guide and aggregator pages give samples. Ten digits are
shared by many carriers, so no rule claims them.

## Links

Averitt documents a direct LTL tracking link that reads a PRO number from `?Number=` on
`tools.averitt.com/servlet/rsoLTLtrack`, with `Type=PN`.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
