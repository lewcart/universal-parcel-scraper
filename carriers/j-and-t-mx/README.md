# J&T Express Mexico

J&T Express Mexico parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

J&T Express Mexico runs its own network, site and tracker, apart from the Southeast Asian J&T
operations in `j-and-t`. Its tracker help says a waybill is `JMX` followed by twelve digits,
the tracker checks that shape, and archived lookups show it. `j-and-t-mx-1` claims it.

## Links

The tracker at `www.jtexpress.mx/trajectoryQuery` reads the waybill from `waybillNo`, as
archived lookups show. It asks for the last four digits of the recipient's phone before it
shows the history.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
