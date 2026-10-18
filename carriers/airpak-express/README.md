# Airpak Express

Airpak Express parcels use enabled universal providers. There is no dedicated adapter.

Airpak Express is a courier founded in Singapore that also runs a Malaysian domestic network
and international express services. Its tracker is a GETOnline page hosted for it.

## Numbers

Lookups archived from the tracker show twelve-digit connote numbers, mostly starting 200 and
also 100, 400 and 800, and eleven-digit numbers starting 810. Bare digit runs of these lengths
are printed by many carriers, so no rule claims them.

## Links

The site's tracking box opens
`tracking.airpak-express.com/tracking_search.aspx?stid=airpak&cn={number}`, and the GETOnline
page sends one number to `go/plm-tracking` with the same `cn` and `stid`. Older lookups put the
number in `cn` on `airpak-express.com/tracking/`, which now redirects to the search page.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
