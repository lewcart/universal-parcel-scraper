# Transcorp

Transcorp parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Transcorp is the GCC logistics group formed when Elite and Transcorp merged. Elite's site now
redirects to Transcorp's, whose tracking page keeps two trackers: Elite's for Elite shipments
across the GCC, and Transcorp's own for the UAE, Saudi Arabia and Qatar.

Elite airwaybills are ten digits. Two lookups on Elite's tracker that a search engine indexed
and a review on Elite's Trustpilot page give them. Ten-digit runs are shared by many carriers,
so no rule claims them and the gap is declared. No public Transcorp tracking reference was
found.

## Links

Lookups on Elite's tracker at `app.elite-co.com/shipments/track` carry the number in
`references`, sometimes also in `awbno`, so
`app.elite-co.com/shipments/track?references={number}` opens one parcel. Transcorp's form opens
`/task/tracking/{reference}` on the tracker host of the chosen country.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
