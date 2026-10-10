# Postal Ninja

Opt-in universal provider: selecting `Postal Ninja` in `providers` (`SCRAPER_PROVIDERS` for
the CLI and server) asks it after the other aggregators, whatever its coverage evidence,
because its international histories rarely have a scan a consumer can place.
Through TRAWL it returns full histories, often with destination legs. Its scan times
have no zone, so only scans of a service whose clock is established are placed (see
[Parsing](#parsing)). Persisted provider name: `Postal Ninja`. The results page needs a
handle from a verified lookup, which cannot be built from the tracking number, so the
link shown to users is the public form.

## How it works

One step, chosen by configuration, with a 45 s budget standalone and 30 s in the chain:

- `trawl` when `FLARESOLVERR_URL` is set. TRAWL's Camoufox passes the widget check on
  the production network. A failure moves on to the next provider without trying local
  Chromium.
- `browser` otherwise: local Chromium (`TRACKING_CHROMIUM_PATH`). It returns only the
  widget's first and latest scans, and automated Chromium usually fails the Turnstile
  check.

Both paths:

1. Open `https://postal.ninja/en/tools`, fill the official embedded widget, untick "save
   this parcel" so no stored parcel is left behind, and submit. The TRAWL
   [compatibility build](../../trawl/README.md) uses `#trawl-number=<number>`
   as its own marker to trigger that submission. It is not an upstream deep link.
2. The widget gets a Turnstile token and signs its requests:
   `POST /track/check` with `{tc, ds: null, lang}` returns `PROCESSING` and a handle.
   Then `POST /track/get` with `{hid, lang, t9n: true, mode: "GET", compact: true}` (plus
   one `AWAIT` if needed) returns only `firstEv` and `lastEv`.
3. TRAWL only: once a completed reply matches the number and its own handle, the same
   session opens `/en/track#/<hid>`. That page requests `/track/get` with
   `mode: "EXISTS"` and no `compact`, which returns the full `track.events`. The capture
   wait restarts within the original budget. The app accepts the new URL only when its
   handle is bound to an identity-matched capture.

The TRAWL path requires full history: a widget-only capture falls through to the next
provider. Compact replies are accepted only on the local Chromium path.

`/track/check` can end a lookup early. A matching `CHLNG_REQ` is a challenge error, and
a matching `UNTRACEABLE` is inconclusive. `FOUND`/`NO_INFO` stay intermediate while
`inProgress` is true, and a completed empty lookup is inconclusive. Replies for other
numbers or handles cannot end the lookup.

## Protection layers

1. Cloudflare in front of the page and API: fresh Node requests get 403 with
   `cf-mitigated: challenge`.
2. Application check: the widget runs Turnstile (action `widget`) and sends the token in
   `X-RC-Token` with a `TSI` suffix. If that fails, the token is empty and the check
   returns `CHLNG_REQ`. The main entry form uses managed Turnstile (`check`, `TSM`) with a
   reCAPTCHA v2 fallback, which fails in automated sessions. This is why lookups go
   through the widget and then the results page, never the main form.
3. Signing: `X-TW-Sign` holds API version 6, a millisecond timestamp and a base64
   HMAC-SHA256 over `version;timestamp;JSON-body`, keyed by a constant in the public
   bundle. A valid signature does not replace the challenge token. The browser path
   lets the widget sign, so the adapter holds no signing constant.

## Parsing

- Identity: `status: FOUND`, `track.tc` equals the number, `track.hid` equals `hid`, and
  the state is `TRACKING`, `FINISHED`, `STOPPED` or `ARCHIVED`.
- `dt` has no zone, and its clock depends on the service that reports the scan (`ds`),
  not on where the scan happened. [clocks.ts](clocks.ts) lists the clocks established
  against the carriers' own instants on the benchmark's parcels (2026-10-10):

  | Clock | Services | Evidence |
  |---|---|---|
  | UTC | Austrian Post, Intelcom, OnTrac, Poste Italiane | Austrian Post 9/9 scans, which post.at shows two hours later in summer; Poste Italiane 9/9 against its epoch times; OnTrac 14/14 on two parcels its API dates at −07:00 and −04:00; Intelcom 5/5 |
  | One zone, wherever the scan happened | Swiss Post (Zurich), Singapore Post (Singapore) | Swiss Post 17/17 on two items, with their arrival scans in El Salvador and China; Singapore Post 9/9 on an item to China, with its Chinese scans |
  | One zone per network, by destination | GOFO Express: US Los Angeles, FR Paris | 20/20 on two US parcels, with New Jersey and New York scans; 7/7 on a French parcel and the newest scan of a YunExpress parcel GOFO delivered in France |
  | The scanning office's | An Post Ireland, CTT Express, Correos de España, DHL Parcel Netherlands, DPD, DPD Poland, DPD UK, GLS, Hermes Germany, MRW, Nova Poshta, Packeta, Poczta Polska, PostNord, Posten Norge, UkrPoshta | Domestic parcels in their countries, `DPD` on the Polish, German and Spanish networks; UkrPoshta's Ukrainian scans of an item to China |
  | The scanning office's, named by its location | FedEx, UPS | UPS 11/11 on two parcels across Eastern, Central and Mountain time; FedEx 16/17 on two parcels from Washington to Florida and from Ohio to Kentucky |

  Every other service's clock is unknown, and its scans keep their wall time.
- A fixed or network clock places its service's scans in any history. A local clock
  places them only in a full history that service reports alone, and for an S10 item
  one whose origin is its destination (`destCn`): beside other services, a service relays
  their scans at other clocks (PostNord gives PostNL's Dutch scans four hours ahead, DHL
  Germany an origin post's scans at clocks that vary by origin). Its zone is the
  destination's, else the service's (`courierZone`, as Ship24 reads its couriers'), else
  the zone routing passes for the parcel's carrier, else that of the one country the
  carrier serves (BRT's Italy). A destination on another clock than the service's may be a
  parcel that crossed a border, and places nothing. A compact widget reply's two scans
  cannot show that one service reports the whole history.
- FedEx and UPS are also placed only in a full history they report alone, each scan by
  the US state or Canadian province its location names before the country ("Atlanta, GA,
  United States"). A state with several zones is read in its majority zone, as Ship24
  and ParcelsApp read theirs: FedEx's scan in Jacob City, in the Florida panhandle on
  Central time, came out an hour early. A location without a state ("United States") or
  without a country ("Chicago, IL") places nothing.
- A local clock writes a scan dated without a time as midnight (FedEx's pickup), which
  places nothing. UPS dates its scans between midnight and 1 a.m. at 12:xx (its arrival
  in Lenexa at 00:25 is 12:25, and a departure from Atlanta at 00:12 comes after the
  delivery), so none of its 12:xx scans is placed.
- A carrier's home is no clock by itself: Poste Italiane's scans are UTC, two hours off
  Rome time in summer, and the consolidators the catalog files under China report their
  destination scans at the destination's clocks.
- Known clocks that still place nothing: DHL Express keeps each facility's clock, but
  names its newest US and Canadian scans without their state ("MARSHALL-USA"); Australia
  Post, Canada Post, USPS and Correios do Brasil keep the scan's clock in countries with
  several; New Zealand Post relays China Post's scans at Chinese time; 4PX gives Chinese
  scans in UTC and US scans twelve hours early.
- Other scans keep their wall time as `local_time`; an explicit offset is kept as it is.
  Once every scan has an instant, scans are ordered by it; otherwise the provider's order
  is kept, because wall times cannot be sorted against instants. If the newest scan has no
  instant, `last_update` is null, and a history with none at all is inconclusive through
  `fetchSource()`.
- A scan dated more than an hour after the reply's `lastFetch` is a deadline, such as
  Posten Norge's "Last day for retrieval", and is left out. A wall time without a zone
  counts only when it is that late in every zone, up to UTC+14.
- `track.toAddress` is never read. At most 1000 events.

## Rejected approaches

- Pure HTTP: signed check/get calls are challenged by Cloudflare locally and from
  production. Replaying fresh `cf_clearance` cookies with the same User-Agent still gets
  403.
- Signed full-mode `fetch` inside the verified browser: works, but the results page
  already makes that request.
- The RapidAPI integration (`IrisKoBar/app_delivery_tracking`): a separate paid service.

## Testing

`npm run test:carriers:live -- providers/postal-ninja` with
`FLARESOLVERR_URL` set: two successive lookups of a public reference, and a synthetic
untraceable number that must stay inconclusive. The local Chromium path is covered by
`testing/universalScrapers.live.test.ts` with `TRACKING_CHROMIUM_PATH`. Unit tests use
synthetic [fixtures](fixtures/README.md).

A service joins [clocks.ts](clocks.ts) on evidence only: its wall times set against the
instants the carrier's own adapter or website gives for the same scans, on more than one
parcel where possible. Raw replies can hold recipient data; keep them outside the
repository.
