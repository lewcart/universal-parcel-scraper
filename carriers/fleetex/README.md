# FleetExpress

FleetExpress parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

FleetExpress is a Canadian last-mile courier that runs on Superroute's delivery platform. Its
API documentation gives order tracking numbers of `SR` and twelve digits and a package number
of `DS` and twelve digits. `SR` is the platform's prefix rather than FleetExpress's own, and
the same documentation uses it for test numbers of other lengths, so no rule claims either
layout.

## Links

The tracking forms on `fleetexpress.ca` and `tracking.fleetexpress.ca` open one parcel at
`tracking.fleetexpress.ca/tracking/{language}/{number}`. The library reads the number from that
address.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
