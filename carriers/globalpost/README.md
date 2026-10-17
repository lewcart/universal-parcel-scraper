# GlobalPost

GlobalPost parcels use enabled universal providers. There is no dedicated adapter.

GlobalPost is Auctane's cross-border consolidation service, sold through ShipStation in the
United States and the United Kingdom. It collects parcels at its own facilities and hands them
to a national post or courier in the destination country, whose number the tracker also shows.

## Numbers

GlobalPost's own numbers start with `GP`, four letters naming the service and ten digits, and
end with `US` or `GB` for the origin; `globalpost-1` claims that layout, which no other carrier
uses. Older parcels carry `SDC` and fifteen digits, which are too rare in public sources to
claim. The tracker also accepts USPS-issued S10 numbers on some services; postal detection
already routes those to USPS, and the final-mile numbers it shows belong to the partner.

## Links

The tracking form opens `goglobalpost.com/track-detail/?t={number}`; archived lookups also
use `t` on `goglobalpost.com/track/`. The library reads the number from either address.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
