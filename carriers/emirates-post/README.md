# Emirates Post

Emirates Post parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Emirates Post's international items carry UPU S10 numbers ending `AE`, which generic postal
detection offers. Domestic items use thirteen digits, a shape many carriers share, so no rule
claims them. Archived lookups on the tracker show both layouts.

## Links

The tracker opens one item at `emiratespost.ae/all-services/track-a-package/step-two` with the
number in `q`. The earlier tracker at `/Portal/Track` took it in `TrackingNumber`.

## Why there is no adapter

The tracker page carries the item's history in its own HTML, with no key or sign-in. Outside the
UAE, Cloudflare answers every request for the site and its API hosts with an HTTP 403 challenge
page. A browser passes it on its own; UAE networks get the page directly. Emirates Post's Android
app (`ae.emiratespost.retailapp`) reads
`GET box.emiratespost.ae/services/pobox/shipping/api/Tracking/Guest/TrackAwbDetails` with a key
the server hands only to installs that pass Firebase App Check, and Cloudflare refuses that
lookup without it from every network, the UAE's included. So Emirates Post stays on universal
providers.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
