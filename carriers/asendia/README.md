# Asendia

Cross-border mail and e-commerce carrier that hands parcels to a destination operator for the
last mile. It runs three public trackers:

- **A1** (Asendia USA), `a1.asendiausa.com/tracking/` (also `a1.asendia.com`). Its page reads a
  JSON API with no challenge. [adapter.ts](adapter.ts) asks it first.
- **Asendia UK**, `uktracking.asendia.com/tracking.php` (formerly wnDirect). A server-rendered
  page with no challenge, for parcels Asendia UK carries, whichever post or courier delivers
  them. [uk.ts](uk.ts) reads it.
- **Global portal** `track.asendia.com`, which serves the other European subsidiaries. Every
  search needs a Cloudflare Turnstile token, so it is not a sync path. [probe.ts](probe.ts)
  keeps its protocol and parser for the Turnstile canary.

A number neither A1 nor Asendia UK knows is not-found for this adapter only; routing then tries
the universal providers in the same check (see [routing](https://github.com/plhery/delivery-tracker/blob/main/docs/ROUTING.md)).

## How it works

1. `direct`:
   1. `GET a1.asendiausa.com/tracking/js/main.js`: the page's public client config (API base
      URL, a shared Basic authorization value, `X-AsendiaOne-ApiKey`, default branded tracking
      key). Same for every visitor, read at run time, cached six hours, never pinned. The API
      host must be an Asendia domain over HTTPS.
   2. `GET <api>/api/A1/TrackingBranded/Customer?trackingKey=`: the page's brand request, used
      to prove the key. A rejected key answers 204 "no customers configured": schema drift,
      not not-found.
   3. `GET <api>/api/A1/TrackingBranded/Tracking?trackingKey=&trackingNumber=`. A warm lookup
      is this single request.
   4. `GET uktracking.asendia.com/tracking.php?ref=<number>&submit=`, when A1 does not know the
      number, fails, or holds only its registration. No cookie or session.
   - The A1 outcome is `responseStatus.responseStatusCode` inside an HTTP 200: 200 with data,
     or 204 "no package data found".
   - A JSON 401/403 from a cached config re-reads the page once.
   - A plain browser-like `User-Agent` is required for A1; Cloudflare answers 403 "error code:
     1010" to library defaults.
   - 25-second budget per lookup, 10 seconds per request. A1 leaves up to 8 seconds, a third at
     most, for Asendia UK.
   - Not-found means both trackers said so. Otherwise A1's failure is reported, or Asendia UK's
     when A1 said not-found.

## Notes

- A bad key also yields 204 "no package data", so a 204 is reported as not-found only if the
  key was proven in the last 15 minutes. Otherwise the key is checked first; if it moved, the
  page is re-read and the lookup repeated once. Without this, a rotated key would bench every
  Asendia parcel as not-found.
- The A1 reply echoes nothing about the query. It is bound to the request through the three
  references its summary reports (carrier original, customer, vendor).
- A1 can hold an Asendia UK parcel's registration alone. The UK history is returned instead
  once it shows progress; otherwise A1's answer stands, whatever Asendia UK says.
- A1 scan codes mean different things per `eventSource` (USPS reuses `10` and `B1`, Broadreach
  uses `B8`), so codes are read only for Asendia's own sources:
  - `A1 … Data` sources: A1 codes (`1` to `1.2` registered, `2` accepted, `2.1` to `2.3` in
    transit).
  - `FullTrack API`: Asendia's harmonized codes from a published list (linked in
    [status.ts](status.ts)). Consumer-return `RET*` and inquiry `CLAIM*` codes are unmapped.
  - Partners (`USPS TrackV2 API`, `BROADREACH API`, `DAI API`, …): exact wording, else the
    shared rules.
- A1's declared final-mile link becomes `delivery_carrier` only through catalog link rules; the
  vendor reference becomes `delivery_tracking_number`, so the host can propose one
  confirmation lookup with that operator.
- A1 weight is converted from pounds; `destination_country` comes from the summary.
- An A1 scan without an explicit offset is dropped.
- Asendia UK's search also matches order and other references the page does not echo, so its
  page is bound only through the parcel's echoed "Tracking Code". A page listing only other
  codes is inconclusive, never not-found. Not-found is only the "No tracking information
  found" notice in the results block; an empty block or changed markup is schema drift.
- Asendia UK's clocks have no offset and do not share one zone: the same scan can appear twice
  an hour apart. They are kept as `events[].local_time` and `last_update_local` in page order,
  newest first; `last_update` is null and clocks are not sorted.
- Asendia UK uses one English vocabulary, mapped by exact wording in [status.ts](status.ts).
  "Information" and "Carrier delays" are notices: they keep no stage and never set the current
  stage, even when newest.
- Asendia UK's partner label (`COLISSIMO`, `HERMES`, `TIPSA`, …) becomes `delivery_carrier`
  through catalog names and the partner's link. A link back to `track.asendia.com` is read by
  its label alone.
- `AS` + 9 digits + `US` needs no S10 checksum: a real A1 number fails it. The generic postal
  rule excludes this shape.
- A1 and Asendia UK also accept customer references, eBay `EEUS…` numbers, merchant references
  and last-mile numbers. They are not specific to Asendia, so there is no detection rule for
  them. S10 numbers issued by a partner post stay with that post.
- Events keep time, wording, code and city/province/country only. Address lines, postal codes,
  service name, order reference and Asendia UK's destination city and state are never read.

## Rejected approaches

- Solving or skipping Turnstile on `track.asendia.com`: out of scope and against the portal's
  intent. Its search refuses a request without a token (HTTP 400 "Turnstile token is
  required.").
- Older group trackers: `tracking.asendia.com`, with its `alliot` API, redirects to the portal;
  `m-tracking`, `trackandtrace` and `etracking` no longer resolve.
- Asendia Sync and MyAsendia need an account. Asendia has no consumer tracking app.
- The documented A1 Tracking v2.0 API (`a1api.asendiausa.com`): 401 without account
  credentials. The branded endpoint is what the public page uses.

## Limitations

- Parcels of Asendia's other European subsidiaries (Germany, France, Switzerland, Spain, Italy)
  and Asia are on neither tracker unless A1 carries them; they depend on the universal
  providers.
- Asendia UK drops parcels some months after posting, then answers not-found.
- No delivery estimate.
- A1 dates partners' scans in true UTC: a Swiss Post scan at 18:20 `+02:00` is A1's 16:20
  `+00:00`, and a German delivery round UPU shows at 09:07 local is A1's 07:07. USPS scans were
  not checked against USPS, and one `A1 Processed Data` scan looked like a California wall
  clock labelled UTC: 22:04 `+00:00`, seven hours before its 05:04 check-in, at the minute UPU
  dates the posting at a California office. Offsets are kept as sent. USPS pre-shipment scans
  are date-only and arrive as midnight UTC.
- A structural change to `main.js` or to Asendia UK's page fails as schema drift.

## Testing

`npm run test:carriers:live -- carriers/asendia`. `adapter.live.test.ts` checks a synthetic
unknown number on A1, after validating the page's public key, and on Asendia UK. Set
`ASENDIA_LIVE_NUMBER` or `ASENDIA_UK_LIVE_NUMBER` to an authorized current shipment to also
check matching history; those tests are skipped without them because both trackers drop old
public examples. Offline fixtures cover history parsing. `probe.live.test.ts` checks that the
portal still rejects an invalid Turnstile token. The probe reads a real token from
`ASENDIA_TURNSTILE_TOKEN` for manual runs.
