# Hercules Freight

Hercules Freight parcels use enabled universal providers. There is no dedicated adapter.

Hercules Freight (Hercules Forwarding, Inc.) is a less-than-truckload carrier between the
United States and Canada, with US headquarters in the Los Angeles area. Its Track Shipment page
looks up a PRO, bill of lading, purchase order or pickup number and shows the shipment's
status, origin, destination and delivery date.

## Numbers

The site's form asks for an eight-digit PRO number, and archived PRO details pages on the
carrier's own host show eight-digit PRO numbers. Bare eight-digit runs are other carriers'
numbers too, so no rule claims them and a gap declaration covers the layout.

## Links

The Track Shipment form posts the number, so no address is used as a template. Older PRO
details pages at `herculesfreight.com/users/viewPRODetails/{number}` and
`herculesfreight.com/forms/viewprodetails/{number}` carry the number in the path.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
