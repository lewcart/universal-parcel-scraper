# Passport

Passport parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Passport's own tracking numbers, in lookups archived from its tracker, are `PG`, ten digits and
two letters naming a country, such as `DE`, `CA` or `SE`. `passport-1` claims the layout. The
tracker also answers the numbers of the posts that deliver abroad, in the UPU S10 layout, which
stay with the generic postal carrier.

## Links

Passport's tracking page at `passportglobal.com/track/` sends the number through a form and has
no parcel address of its own. Archived lookups opened one parcel at
`track.passportshipping.com/{number}`; that host now forwards to `track.passportglobal.com` and
keeps the path, so the library opens `track.passportglobal.com/{number}`.

## Testing

Provider live-test inputs and commands are in the [provider READMEs](../../providers/README.md).
