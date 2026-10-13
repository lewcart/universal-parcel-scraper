# Forward Air

Forward Air shipments use enabled universal providers. There is no dedicated adapter.

## Numbers

Forward Air tracks expedited less-than-truckload freight by its waybill (airbill) number, which
its help pages describe as eight digits; the tracking page also finds a shipment by the
customer's own reference. Lookups archived from that page show eight-digit waybills. Eight
digits are shared by many carriers, so no rule claims them; a caller names the carrier or
pastes a tracking page link.

## Links

The tracking page reads waybill numbers from `numbers` on `forwardair.com/tracking` and looks
them up straight away. The library reads the number from that address.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
