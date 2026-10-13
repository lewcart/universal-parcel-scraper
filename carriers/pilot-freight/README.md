# Pilot Freight Services

Pilot Freight Services parcels use enabled universal providers. There is no dedicated adapter.

Maersk owns Pilot. Its network now trades as Maersk Ground Freight, and its tracker
on `delivers.maersk.com` still reads Pilot's own tracking service.

## Numbers

A Pilot pro number is nine digits. Pilot's tracking API documentation gives two in its request
example, and archived lookups on its former quick-track page show more. No rule claims the
shape: nine bare digits are shared by several carriers, and nothing in the number points to
Pilot.

## Links

Maersk's ground freight tracker opens one shipment at `delivers.maersk.com/tracking/` followed
by the pro number. Pilot's former `quicktrack.aspx` page read it from `?Pro=`; that address now
redirects to Maersk.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
