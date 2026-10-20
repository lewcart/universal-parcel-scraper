# SF Express

SF Express waybills (12 digits, or `SF` + 13 digits), tracked through the anonymous route query
behind the official [Taiwan tracking page](https://htm.sf-express.com/tw/en/dynamic_function/waybill/),
driven by the TRAWL browser service.

The `SF` family identifies the carrier, following the official
[waybill layout](https://open.sf-express.com/InternalWaybillGuide).
Unprefixed waybills remain ambiguous with other carriers. Both forms end in a check
digit over the serial after the three-digit area code. A 12-digit waybill that passes
moves to the front of the suggestions, behind FedEx when FedEx's own check also passes;
an `SF` number that fails stays a suggestion.

## How it works

1. `trawl`: TRAWL opens the Taiwan page for the number (tiers 2–3, no plain HTTP) and captures the
   page's own call to
   `GET https://htm.sf-express.com/sf-service-core-web/service/bills/{number}/routes?lang=en&region=tw&translate=&app=bill`.
   - The page opens a GeeTest v4 slider in bind mode with no start button, which TRAWL's generic
     solver can't drive. The scoped helper [`sf-express-session.mjs`](../../trawl/sf-express-session.mjs)
     solves it; see [`trawl/README.md`](../../trawl/README.md). A puzzle its detector cannot read is
     replaced through the widget's refresh button, at most twice, rather than failing the lookup.
   - The page adds its own short-lived verification headers. Each lookup uses a fresh isolated
     context; no cookies, tokens or phone suffix are stored.
   - Only a capture whose URL matches that number and query exactly counts. A hidden widget is not
     success.

Budget: 45 s by default (max 60 s), including a 15 s TRAWL transport allowance.

## Notes

- There is no reliable not-found. `code: 60000` (`运单路由查询被管控`, query restricted) and captcha
  failures (`code: 1` "captcha verification failure", `70000`) are challenges; synthetic numbers get
  `60000` too. `500` is indeterminate, and so is an empty success envelope: SF sends one for
  waybills it has scanned too.
- On the capture: 401/403 is a challenge, 404/410 means the endpoint is gone, 429 is rate limited
  (honours `Retry-After`).
- Exactly one `result` entry must have `id` equal to the number. Sibling references and
  shipment-wide personal detail objects are ignored.
- Each scan is classified by its own `opCode`. Code `202` (已出库) sits in the frontend's warehouse
  "delivered" group but means warehouse dispatch, not delivery. Codes `8000` and `70` (a delivery
  that did not happen) depend on their `stayWhyCode`; unknown combinations stay unclassified. Code
  `99` reads both "being returned" and "being forwarded", so it stays unclassified too.
- Summary `expressState` `99` is broad transit, so a mapped latest scan wins over it. Other summary
  states win over the scan.
- `scanDateTime` has no offset. Every scan's clock reads UTC+08:00, the time of mainland China,
  Hong Kong, Macau and Taiwan, none of which keeps daylight saving, wherever the scan was made.
  SF's international history, which 17TRACK relays with each scan's offset, places scans at sites
  in Australia, the United Kingdom, Belgium, France and the United States at the instants these
  clocks give on UTC+08:00, hours from the sites' own clocks, and flights between China and those
  countries only take a plausible time on that reading. A scan's instant comes from its own clock
  alone. The newest scan is the last update, and a delivered parcel's newest delivery scan the
  delivery time. Events sort by their clocks, like the portal. There is no ETA.
- A scan's `zoneCode` names its site, a three-digit mainland area code (`755` is Shenzhen) with
  letters for the site, `852` or `853` for Hong Kong or Macau, or abroad an airport's code with a
  number and a letter. Its clock does not follow the site, so the adapter does not read it.
- "AWB Info & POD" rows are proof-access links, not scans, and are dropped. Phone controls are
  stripped from remarks, and delivered scans read `Delivered`.
- Not used: [SF International](https://www.sf-international.com/us/en/support/querySupport/waybill)
  (Tencent verification) and the Mainland China portal (GeeTest plus phone verification).
- Not used: SF's Android apps. `com.sf.hmto` posts to
  `https://hmto.sf-express.com/cx-app-query/query/app/waybillNo/queryWaybillByBNo` with a signature
  computed in a packed native library, and asks for the last four digits of a phone number. Its
  scans carry a date and a time with no zone. `com.sf.iapp` posts to
  `https://iccsp.sf-international.com/iccsp/api/app/queryRouteV1`, which requires a signed-in token.

## Limitations

- Anonymous access may not cover every shipment class; restricted numbers get `60000`.
- Weights, facility IDs, estimates and personal detail blocks are not read. At most 100 of 500 scans
  are kept, and a longer history is marked truncated.

## Testing

`npm run test:carriers:live -- carriers/sf-express` with `FLARESOLVERR_URL` and
`SF_EXPRESS_TRACKING_NUMBER`. Optional: `SF_EXPRESS_EXPECTED_EVENTS` (exact event count) and
`SF_EXPRESS_CHECK_RESTRICTION=1` (checks that a synthetic number gets the restriction).
