# Daylight Transport

Daylight Transport shipments use enabled universal providers. There is no dedicated adapter.

## Numbers

Daylight tracks less-than-truckload freight by its probill (PRO) number. Lookups archived
from its former tracing pages show eight-digit probills. Eight digits are shared by many
carriers and the probills carry no check digit, so no rule claims them; a caller names the
carrier or pastes a tracking page link.

## Links

The home page's Track PRO form opens one shipment at `mydaylight.dylt.com/external/shipment`
with the number in `probill`, and the former tracing result page took it in `SelectionValue`.
The library reads the number from both.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
