# FedEx Freight

FedEx Freight shipments use enabled universal providers. There is no dedicated adapter.

FedEx Freight is a less-than-truckload carrier serving the United States, Canada and Mexico.
Its tracking page also finds FedEx Custom Critical shipments.

## Numbers

FedEx Freight tracks freight by its PRO number. An archived lookup on its own tracking page
carries a ten-digit PRO marked with FedEx's code for FedEx Freight. Ten digits are shared by
many carriers and nothing in the number points to FedEx Freight, so no rule claims them; a
caller names the carrier or pastes a tracking page link. The digit runs the tracking page
prints as input examples are not recorded. Handling-unit labels carry their own parcel-style
tracking numbers, which stay with the FedEx entry.

## Links

`fedexfreight.com/fedextrack/?trknbr={number}` opens one shipment: the site's tracking
settings point there and archived lookups use it. The library reads the number from `trknbr`.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
