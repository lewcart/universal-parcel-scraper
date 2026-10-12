# Lietuvos paštas

Tracks Lietuvos paštas items and LP Express parcels through the self-service API behind LP
Express's tracking page.

## How it works

The tracking page on `lpexpress.lt` asks `api-esavitarna.post.lt`, which answers without an
account, cookie, key or browser. The adapter sends one
`GET https://api-esavitarna.post.lt/v2/tracking/{number}/events` with `Accept-Language: en`, which
picks English wording. A request that fails to reach the service is sent once more within the
budget. The page uses the first version of the same route, which answers a bare list of rows and
so cannot tell an unknown number from a known one without rows; the second version can.

The reply must name the whole requested number. An unknown number comes back with an all-zero mail
identifier and no mails, and only that answer is a missing parcel. A known mail without rows is
inconclusive. The F5 firewall in front of the API rejects some clients, a bare `Mozilla/5.0`
user agent among them, with an HTML page under HTTP 200; that page, HTTP errors and malformed
replies keep their own failure kinds. Recognition uses the same lookup.

The parcel search on `post.lt` reads the same data, but its form sends a proof-of-work token that
its server checks, behind an F5 script check, so it is not used.

## Numbers

LP Express parcel numbers are `CC`, `CH` or `HC`, nine digits and `LT`. They borrow the UPU S10
layout, but many fail its check digit, so the generic postal carrier does not take them.
`lietuvos-pastas-1` suggests Lietuvos paštas at low confidence, because Chronopost's rule for any
S10-shaped number also matches. The adapter takes any two letters, nine digits and `LT`, and any
S10 code with a valid check digit; anything else is invalid without a request.

A code ending `LT` with a valid check digit is Lietuvos paštas's, LP Express parcels included,
but the issuer of an S10 code does not establish who delivers it, so detection keeps such codes
with the generic postal carrier. `lietuvos-pastas-s10` makes preflight ask Lietuvos paštas about
them at low confidence.

## Notes

Each row carries a public event type, English wording, a clock, a country and often a place. The
adapter maps the types from the API documentation's public event list and keeps the type; a type
the map leaves open goes to the shared wording rules. A message to or from the recipient keeps the
stage of the row before it, and a delivery after a return started reaches the sender, so it reads
as returned. The tracking page leaves out a return label's mail, and so does the adapter.

Every clock carries Vilnius's offset. Rows in Lithuania are Vilnius times. A row from abroad
carries that country's wall clock under the same offset, so it is read in the country's zone, or
kept as a wall clock without an offset when the country has several zones.

A place is kept when it is a town, a sorting centre or a country, which a row from abroad names
in Lithuanian and the adapter in English. A parcel locker or post office keeps its name and town;
its street and postcode are dropped, as is any other place with several parts, which could be a
door address, and the self-service site that creates labels. The pickup point is the locker the
parcel waits in, while it waits there or once it was collected there, unless it was sent back.

## Limitations

The service keeps a parcel's rows for a limited time, after which it answers as a known mail
without rows. The reply has no delivery estimate, weight or service name. Types whose meaning for
the delivery is unclear, such as a hold at an office, are staged only when their wording says
enough.

## Links

LP Express's tracker opens one parcel at `lpexpress.lt/track?parcel={number}`, the address its
copy-link button builds. Archived lookups also used `lpexpress.lt/track/id/{number}`,
`lpexpress.lt/tracking/{number}` and the `num` parameter of the former parcel search on
`post.lt`. The current tracker on `post.lt` posts its form behind a proof-of-work check, so no
address there opens a result.

## Live test

Set `LIETUVOS_PASTAS_TRACKING_NUMBER` outside the repository and run
`npm run test:carriers:live -- carriers/lietuvos-pastas/adapter.live.test.ts`.
Optionally set `LIETUVOS_PASTAS_UNKNOWN_NUMBER` to check a number the service does not know.
