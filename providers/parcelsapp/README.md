# ParcelsApp

Second universal provider. It often returns fuller histories than Ship24, especially
destination legs, and is the only provider that uses the parcel's stored delivery
postcode. Persisted provider name: `ParcelsApp`. Link shown to users:
`https://parcelsapp.com/en/tracking/{number}`.

## How it works

All steps share a 45 s budget. The router reserves the same amount, and a shorter caller
deadline still wins.

1. `direct`: [http.ts](http.ts) sends one form-encoded anonymous
   `POST https://parcelsapp.com/api/v2/parcels`, capped at 30 s because cold lookups
   aggregate on demand (later requests hit ParcelsApp's cache), and at 2 MB. It uses no
   cookies, bootstrap page, cache or redirects. A stored postcode goes in
   `extra[zipcode]`, trimmed, with leading zeros, spaces and letters kept.
2. `retry`: after a network failure, timeout or cut-off body, one more direct attempt
   after 2 s, with the same input. The public frontend retries the same way. The deadline
   is the smaller of 30 s and the remaining budget. The retry is skipped if the backoff
   does not fit. Two network failures end the lookup without a browser.
3. `trawl`: on a challenge (`RELOAD`) or schema drift, TRAWL (`FLARESOLVERR_URL`) loads
   the tracking page (`skipHttp`, up to tier 3) and captures `/api/v2/parcels` replies
   with a 15 s settle window. Bodies are parsed newest first, skipping polling replies
   and other shipments. If no body is readable, the rendered event list
   (`.tracking-info .parcel .events > .event`) is parsed instead.

Other outcomes:

- HTTP errors on the direct step. A 429 or 5xx keeps its status and `Retry-After` and gets
  no browser attempt.
- `NO_DATA`, `NO_TRACKER` and empty histories are inconclusive, not proof that the
  shipment does not exist. They end the lookup.
- A reply that only asks for a postcode raises `input_required`. Browser recovery cannot
  submit a postcode and never retries a known input gate. A gate row names the carrier
  asking, as a scan does (`states[].carrier`); when every gate names the same one and it
  maps to a catalog carrier, the error's `carrier` gives that id.

## Request construction

Built from the site's tracking bundle (`packs/js/application-….js`; the
`assets/application-….js` bundle only holds jQuery and UI code):

- `trackingId`: each ASCII character shifted by 76 modulo 126, URI-encoded, then
  form-encoded again.
- Fixed fields: `carrier=Auto-Detect`, `language=en`, `country=Unknown`,
  `platform=web-desktop`, `wd=false`, `c=true`, `p=5`, `l=3`.
- `se`: a browser telemetry string (screen and document sizes, visibility, navigator and
  WebGL properties, base64 host and stack; `undefined` is accepted for the stack),
  followed by the telemetry length, the number's length, and the unsigned MurmurHash2
  (seed 978) of `encodeURIComponent(number) + telemetry`. The adapter sends one fixed
  telemetry profile. Without the trailing checksum tuple the API returns `RELOAD`.
- A stored postcode uses `extra[zipcode]`.

`se` is a public checksum, not an issued credential, so Node alone is enough. The browser
step exists for future protocol changes.

## Parsing

- API scans retain their reported location. Chronopost's delivery-service label in that
  field is excluded because it names a service, not a place, and so is Posti's "ULKOMAILLA"
  ("abroad"). A repeat without a place keeps the location another copy of the same scan
  reported.
- Identity: the API reply does not echo the number, so a direct result is bound to the
  single POST that sent it. A different `correctId` is rejected as an unverified alias.
  A browser capture must render exactly one matching `Tracking number` row in the result
  table. The requested URL is not proof, because the page can render another shipment or
  an empty result for it.
- Times: `states[].date` is the scan's local clock, labelled as UTC or shifted into a
  wrong offset (a DPD scan at 14:05+02:00 comes back as `14:05+00:00`). The adapter
  keeps the UTC digits and re-reads them in the first zone it finds:
  1. the home clock of a network ParcelsApp names its own way (see Home clocks below),
     else the catalog zone of the scan's carrier (`carriers[state.carrier]`), unless it is
     UTC;
  2. the country at the end of `location`, past a trailing postcode ("Example Town,
     Denmark, 4600"), if `COUNTRY_ZONES` ([core/time](../../core/time/index.ts)) gives it
     a single clock, else, for the North American scans of a few carriers, their state's
     or province's zone (see North American scans below);
  3. the country that name ends with, after a catalog carrier or brand ("DPD UK",
     "GLS Italy", "DHL Parcel Netherlands"), if that country has a single clock. It comes
     after the location because the name can be a branch, not the scan's place
     ("Cainiao (China)" scanning in Spain). When the number's depot range picks another
     network of the brand, that network's zone replaces it: a DPD UK number filed under
     "DPD France" is on London time, as DPD UK's page, Ship24 and 17TRACK show. A few
     networks named without a country have their home country's clock here (Home clocks
     below);
  4. for a bare brand or brand group ("DPD Group", "GLS", "Hermes") on a scan with no
     location, the zone of that brand's catalog carriers, if every one of them reads the
     digits as the same instant;
  5. the zone routing passes for the parcel.

  Steps 3 and 5 only guess where the scan was. A `location` ending with any other country,
  by ISO code or by name in English, German, French, Italian, Spanish or Dutch ("Example
  City, CA, US", "Example City, South Africa"), rules them out and the scan stays as
  labeled. Canada Post's "USA" and Orange Connex's "United States of America" and
  "People's Republic of China" name the US and China too; the last also places a scan on
  China time in step 2. A location that names no country ("Example Hub", "Toronto, ON")
  rules nothing out, and step 4 only reads scans without a location. A country added to
  `COUNTRY_ZONES`, or a country name `countryCode` newly reads, therefore moves the stored
  scans located in it, as a changed catalog `timezone` moves its carrier's, and so their
  event ids. So does a reported name newly mapped to a catalog carrier on a local clock
  (`NAME_ALIASES` in [hints.ts](../../core/catalog/hints.ts)), for the scans under that
  name. Plan a re-key of stored ParcelsApp rows with any of these changes.

  With no zone, an offset is taken as given, except for the carriers whose dates are
  never instants (Wall clocks below). Steps 3 and 4 choose a zone only:
  `carrierIdFromName` still treats these brands as ambiguous, so discovery and routing
  are unchanged.
- A state with no `date` (an Asendia Spain leg listed after dated US scans), or with an
  offset-less date that no zone resolves, has no instant. It is skipped and counted in
  `undated_event_count`, so it never becomes the latest scan, sets the stage or
  `last_update`, or moves the freshness watermark. A malformed date still fails the reply.
- DHL Express scans carry the facility's clock, whatever the label: DHL's mobile API gives
  the same clocks scan for scan, and Ship24 gives them with the facility's offset. They
  skip the steps above and take the zone the
  [DHL Express rule](../../carriers/dhl-express/clock.ts) reads from their location. A scan
  the rule cannot place is a wall
  time: it is left out and counted like an undated state. When it is the reply's latest
  scan the reply is inconclusive ("cannot place the latest DHL Express scan"), so an older
  scan does not stand in for the parcel's state and routing asks the next source. The
  rendered page prints no location, so it places none of them.
- Wall clocks: the dates of USPS, Canada Post, GOFO's US scans, SpeedPAK, EMS, Cainiao,
  EcoScooting and 4PX are each scan's local clock under a label that is never its instant
  (checked 2026-10-10 scan for scan: USPS's page and the "at 8:25 am" in the status text
  ParcelsApp relays; Canada Post's own digits; GOFO's US feed, which gives the offsets;
  Orange Connex's times and offsets for SpeedPAK; the EMS office clocks Parcelforce and NZ
  Post relay; Cainiao's leg by leg, on GMT+8, +2 or +1, also under EcoScooting, whose
  Spanish and Portuguese scans differ by an hour). They are read in the state or province
  (North American scans below) or the single-clock country their location names, by a
  copy (below), or by the guess of step 3.
- A wall-clock scan none of these places borrows a clock, a guess: the zone of the scan of
  the same network just before it by wall clock that the reply does place, else of the one
  just after it, else routing's zone (step 5). A zone its location rules out is skipped: a
  scan in "USA" takes no Canadian or Chinese zone. The guess holds when the scan happens
  where its neighbours do, and is hours off when it does not. Checked on 2026-10-10
  against the carriers' own clocks: Canada Post's first scan and one in Chicago took the
  right zone, and its last two, in Montana, the Chicago hub's, an hour off USPS's.
  SpeedPAK's four took the right one, and a Chinese system event the US one, 14 hours off.
  4PX's nine did; its four between the departing flight and the first US scan took
  China's, and its first scan the US label's, 12 hours off. No source gives the clock of
  USPS's "In Transit to Next Facility", which borrows its neighbours'.
- GOFO's and Cainiao's scans borrow nothing: their placed neighbours keep another clock.
  GOFO's with no place are its labels, which GOFO's feed dates on Pacific time wherever
  the parcel is injected (a Florida parcel's at -07:00). Cainiao's, in a reply another
  network delivers, are its origin leg on China time, while its placed scans copy the
  delivery's: borrowed, a US parcel's "Order received" came 12 hours after GOFO's label,
  and read on China time 19 seconds after it.
- A wall-clock scan with no zone at all is a wall time, left out and counted as for DHL
  Express, and a reply whose latest scan it is is inconclusive ("cannot place the latest
  scan"). Routing passes no zone for a carrier on UTC in the catalog, as these are. So an
  EMS, Cainiao or EcoScooting reply that places none of the network's scans ends there, as
  does one whose latest scan is Cainiao's copy of another post's (bpost's, CTT's or Japan
  Post's last mile, with no place), a Canada Post scan in "USA" after only Canadian ones,
  or a USPS scan with no location after only other carriers' scans. Borrowing moves the
  stored scans it now dates, and the names read as the US or China above move theirs: plan
  a re-key.
- 4PX's dates are the instants of 4PX's own feed, which reads every scan's wall clock on
  China time, its US scans too: 4PX's page shows a New York delivery at 14:30 with its
  -04:00 offset, and ParcelsApp has 06:30Z. The wall clock is that instant's Shanghai
  digits, read where the location places it. 4PX writes the country first, in fixed
  fields ("US  NY  EXAMPLE CITY 12345", "US    EXAMPLE CITY NY DISTRIBUTION CENTER"). An
  instant is right only for a scan on China time, so a scan with no place, or in "US"
  alone, borrows a clock as above.
- GOFO France's dates carry real offsets ("+02:00"), the instants of GOFO France's own
  feed, and are taken as given. Other carriers' copies of the same scan (YTO's, Cirro's,
  EQuick China's) write its digits under a UTC label; a copy with the same digits and
  wording takes that offset, so it does not stand as a later or earlier scan.
- Home clocks: some networks are named their own way, and their dates are their own
  instants or labels shown on their home clock wherever the scan was (checked
  2026-10-10). "Italy Post" has Poste Italiane's epoch milliseconds on Rome time. "New
  Zealand Post" has NZ Post's UTC instants on Auckland time, also for the scans it relays
  from abroad ("Hong Kong"). "Singapore Post" has SingPost's "+08:00" digits, also for its
  scans in China, and "SunYou - Sytrack" those of SunYou's "+08:00" feed. Step 1 reads
  them on that clock. "South Korea Post" (Korea Post's page), "Posten Norge - Norway
  Post" (Bring's offsets, in Denmark too) and "Royal Mail" (Parcelforce's offsets) were
  checked at home only, so their home clock is a step 3 guess that a location in another
  country rules out. A name added here moves its stored scans: plan a re-key.
- TNT's international scans (9-digit numbers) skip these steps. tnt.com gives them
  offsets, and ParcelsApp's `date` is already their UTC instant.
- So do scans named "Asendia United States" or "Asendia USA", wherever they happened.
  Their dates are the UTC instants of Asendia's A1 feed, and Swiss Post's own scans of
  the same item agree (the Asendia USA references in
  [numbers.json](../../carriers/asendia/numbers.json)). The same A1 scans filed under
  another name are not UTC: an eBay shipment's, under "EasyShip", carry local clocks
  (Ship24's instants and Swiss Post's own scan agree once they are read that way), so
  they go through the steps like any other scan, US ones included (below). Those that
  name only the country stay as labeled, hours early.
- So do Paack's scans. Paack's timeline gives instants, not wall clocks, and ParcelsApp's
  `date` is their UTC instant: Paack's own lookup gives the same instants scan for scan.
  Read on Paack's Paris clock, they came out two hours early in summer.
- North American scans: the dates of UPS, FedEx, UniUni and EasyShip are the scan's local
  clock, as UPS's own instants, FedEx's own page, UniUni's own feed and Ship24's offsets
  show on US scans (UPS's also in Germany, the Netherlands and Spain; no public Canadian
  reference was found), and so are those of the wall-clock carriers above. Step 2 reads
  them in the zone of the US state or Canadian province the location names ("Riverside,
  CA, US", "Charlotte, NC", "Linden, NJ 07036", "Scranton PA", "Mississauga, ON, CA",
  USPS's "EXAMPLE CITY IL DISTRIBUTION CENTER" and "ISC EXAMPLE CITY IL (USPS)"), the
  majority zone where there are several, as in the USPS adapter. A state written out
  counts only after the country ("Example City Minnesota, United States of America", as
  Orange Connex writes SpeedPAK's), since Georgia is a country too. A code shared with a
  single-clock country (DE, IL, IN, MT, NL, SK) counts, before that country, only for a
  town of the state or province: UPS writes both "Chicago, IL" and "Koeln, DE". The town
  lists come from the server's GeoNames gazetteer, and a name the country also has for
  more people stays the country's ("Salem, IN").
  [generate-region-towns.mjs](../../scripts/generate-region-towns.mjs) writes them. Another
  shared code ("GA" is Gabon) counts only in a reply that is in North America: one scan
  certainly is, or one names a state or province and none names another country. A copy
  of such a scan from another carrier, at the same minute with the same wording (Cainiao
  relaying UniUni, YunExpress relaying GOFO), takes the same zone. Other carriers keep
  their readings: OnTrac's dates are UTC, and Landmark's keep one clock in every country.
  UPS, FedEx, UniUni and EasyShip scans that nothing places still stay as labeled. Adding
  a carrier, a town or a province moves stored scans: plan a re-key.
- TIPSA's `date` has the digits of TIPSA's own shipment page, which keeps Madrid time for
  every agency ([TIPSA](../../carriers/tipsa/README.md)), so step 1 reads its Portuguese
  scans on Madrid time too.
- Brand zones: a bare brand does not say which network scanned. The DPD, GLS and Hermes
  carriers in the catalog all keep Central European time, which step 4 checks for each
  scan, DST changes included. A brand with a UTC carrier (DHL, through DHL eCommerce) gets
  no zone. A location that names no single-clock country ("Toronto, ON", "Chicago, US")
  can be one of the brand's networks outside the catalog, so step 4 skips any scan with
  a location. A location-less scan from such a network (a UK depot shown only as "DPD
  Group") would still be read as Central European time.
- Brand zones follow the catalog. A new DPD, GLS or Hermes carrier, or a changed
  `timezone`, on another clock turns step 4 off for that brand and moves its stored scans,
  and so their event ids: plan a re-key of stored ParcelsApp rows with such a change.
  `hints.test.ts` pins the current zone sets so the change cannot pass unnoticed.
- The rendered page prints the same UTC digits (`dd LLL yyyy HH:mm`) and names each
  scan's carrier under its wording (`.event-content .carrier`), so it goes through the
  same steps and gives the same instants, and event ids, as the JSON reply. It shows no
  scan location, so step 2 never applies there and nothing rules out steps 3 and 5. A
  wall-clock carrier's scan there has no place to be read in and no placed scan to borrow
  from, so only routing's zone, a guess, dates it, and its UTC digits carry no offset for
  GOFO France's copies to take. The server's timezone is never used. It prints
  a state with no date as `aN Inv NaN` at `aN:aN`, which is counted the same way.
- Cross-border replies stay uncertain: scans can be filed under the wrong operator (an
  India-to-France parcel listed La Poste scans under India Post).
- Notices are skipped, not events: `require_fields` rows, postcode, sign-in and
  destination-country prompts, and rows rendered with a date but no time.
- Some carriers' labels arrive written twice (TIPSA's `ENTREGADOENTREGADO`). A label made
  of two identical halves is read once, in the JSON reply and on the rendered page; any
  other label is kept as sent.
- `carriers` and `services[].name` become `reported_carriers`. They include carriers
  ParcelsApp asked without an answer, so `discovered_carrier` comes from the one name
  they list, or else from the carrier every scan names (`states[].carrier`), when that
  name maps to a catalog carrier. A bare brand ("DPD Group") maps only when the number
  leaves one of its catalog networks (a DPD depot range picks DPD Switzerland or
  France); routing then confirms it with that carrier's adapter. The rendered page's
  per-scan carrier names give the same hints.
- Sender, destination and estimate fields are not kept.

## Limitations

- Postcode unlock is unverified. For an invalid postcode, SEUR and bpost repeat
  `require_fields` instead of returning an explicit error, both in the real form and via
  HTTP. Verifying the unlock needs a known valid number and postcode pair.
- Rate limit. On 2026-10-10 ParcelsApp blocked an address after about 145 lookups in 40
  minutes, three or four a minute, most of them for numbers it had not cached. From then on
  it answered every lookup from that address with an instant `{"error":"NO_DATA"}` and
  HTTP 200, for any number, on the website too. The block still held four hours later.
  Another network got answers, and so did the production server, at a few lookups an hour.
  The adapter cannot tell this answer from a real one, which is one reason `NO_DATA` stays
  inconclusive.
- Test with the adapter, not curl. The same day, curl from the production server got
  `NO_DATA` for a parcel the adapter fetched from that server and address minutes
  earlier, with the same body and User-Agent, over HTTP/1.1 and HTTP/2.
- Email, phone, house-number, sign-in and country-selector forms are not supported.
- `Estimated delivery` forecast rows are projected as events and can set `last_update`.

## Rejected approaches

- Plain GET of the tracking page: returns the application shell only.
- The API-key client (`locky42/parcels-app-provider`): needs a provisioned key.
- Browser-only lookups (as in `thefuga/parcelsapp-crawler`): slower, and unnecessary.
- Retrying an empty answer in the caller's country through the website's country selector
  (`extra[manualCountry]`; the top-level `country` alone selects nothing): it recovered no
  history in a host's lookups, and spent a request each time.

## Testing

`npm run test:carriers:live -- providers/parcelsapp` with
`PARCELSAPP_LIVE_NUMBER` set, and optionally `PARCELSAPP_LIVE_POSTCODE`,
`PARCELSAPP_LIVE_EXPECTED_STATES` and `PARCELSAPP_LIVE_EXPECTED_EVENTS`. Keep live
values out of the repository. Unit tests use synthetic
[fixtures](fixtures/README.md) and never contact ParcelsApp.
