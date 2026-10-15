# iMile

iMile delivers cross-border e-commerce parcels, mostly flown in from China, in the Middle East,
Latin America, Europe, South Africa and Australia. Tracked through the lookup its tracking page
makes.

## How it works

1. `direct`: one `GET https://www.imile.com/saastms/mobileWeb/track/query?waybillNo={number}&code={code}`
   with the headers `lang: en_US` and `sign`, as the tracking page sends it. `sign` is the
   number encrypted with the RSA public key in the page's script (PKCS#1 v1.5, base64), and
   `code` is the MD5 of the number followed by a salt from the same script. Both values are the
   same for every visitor and ship with the adapter. No cookie, account or browser. The JSON
   reply has the shipment and its scans, newest first, in English.
2. `retry`: the same read once more when the first did not reach the site.

- An unknown number is HTTP 200 with `"resultObject": null`, which the page reports as no data.
  A missing or wrong `sign` gets the same reply, so after an empty reply the adapter reads the
  tracking page and its script, at most once an hour, and asks again if the key or salt
  changed. A page that no longer names its script, or a script without the values, is a
  changed page.
- A `status` other than `success` is inconclusive, or rate limited when its message says so. A
  404 or a redirect is a moved route. Cloudflare, in front of the site, lets the package's
  default User-Agent through.
- The shipment must echo the number asked.
- There is no recognition. No rule claims iMile's numbers, so preflight would never ask.

## Notes

- Each scan's `time` is a wall clock to the second with no zone. The page says it shows the
  recipient country's time. In a Saudi history the take-off and landing scans read five hours
  behind the clocks of the flight's own schedule line, which are China's, so the scans are
  Saudi time. Australia, Brazil and Mexico span several zones and the reply does not say which,
  so the clocks stay `local_time`.
- A scan's description is its own sentence, with the centre names in 【】 that the page shows.
  The `trackStage` code stages it: Delivered (`2060`), Return Handling Process (`1008`) and
  Returned to Client (`2065`) decide whatever the sentence says. In Transit (`1002`) and
  Delivery (`1003`) cover flights, clearance, centres, delivery runs and drivers' reasons, which
  the sentence tells apart. A booked flight, a booked delivery day and a stock count move
  nothing. Some scans come without a code.
- Delivery runs lose the driver's phone, deliveries lose who took the parcel, and Brazilian
  deliveries and returns lose iMile's support contacts. The proof-of-delivery photos some
  countries link are not kept.
- `country` is iMile's own three-letter code, mostly ISO's, though `KSA`, `UAE`, `RSA` and `BIH`
  (Bahrain) are its own. It becomes `destination_country`.
- The page shows `lmWaybillNo` as the last-mile number of US parcels. The reply names no courier
  for it, so there is no hand-off.
- The page asks `/saastms/mobileWeb/getLatestDeliveryDate` for an estimated delivery date. The
  answers seen were empty, so the adapter does not ask.

## Limitations

- No estimated delivery, weight or service, and no delivery time as an instant.
- The tracker also answers marketplace references with CNBR and AP prefixes, which belong to
  the sender's logistics partner. The adapter tracks one filed under iMile, but no rule claims
  them.

## Numbers

iMile's own waybill numbers are thirteen digits. Thirteen digits are a bare counter many
carriers share, so no rule claims them. Its Italian parcels also carry `IM` and fourteen
digits, which iMile calls their waybill number; the samples seen are too alike to establish a
rule. The samples and their sources are in [`numbers.json`](numbers.json).

## Links

The tracker on `imile.com` opens one parcel at `/<country>-<language>/track` with the number in
`?waybillNo=`. The form on the English page builds that address.

## Testing

`npm run test:carriers:live -- carriers/imile`, with `IMILE_TRACKING_NUMBER` and optionally
`IMILE_UNKNOWN_NUMBER` set outside the repository.
