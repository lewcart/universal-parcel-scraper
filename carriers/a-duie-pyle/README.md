# A. Duie Pyle

A. Duie Pyle shipments use enabled universal providers. There is no dedicated adapter.

## Numbers

A. Duie Pyle tracks less-than-truckload freight by its PRO number. Lookups archived from its
own shipment status page show nine-digit PROs. Many carriers issue nine digits, so no rule
claims them; a caller names the carrier or pastes a tracking page link.

## Links

The shipment status page reads a PRO from `?tracking=` on
`aduiepyle.com/resources/shipment-status/` and looks it up straight away. The library reads the
number from that address.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
