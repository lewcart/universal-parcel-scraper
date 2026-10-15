# J&T Express Brazil

J&T Express Brazil parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

J&T Express Brazil runs its own network, site and tracker, apart from the Southeast Asian J&T
operations in `j-and-t`. Its waybills in archived lookups and complaints are fifteen digits
starting with 888. Detection does not offer them, since fifteen digits are shared with other
carriers' rules.

## Links

The tracker at `www.jtexpress.com.br/trajectoryQuery` reads the waybill from `waybillNo` and
searches it, as the site's script and archived lookups show; the mobile page
`/mobile/expressTracking` takes the same parameter.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
