# DX

DX parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

DX's tracking page sends a letter and seven digits, or eight digits, to DX Freight, twelve
digits to DX Network Services and any other reference to its secure delivery tracker, which
takes the ten-digit numbers in DX's delivery emails. `dx-1` suggests DX for a `C`, `L` or `W`
and seven digits at low confidence, because GLS references share the length. Ten digits are
not claimed.

## Links

DX now trades from `dxlogistics.com`, whose tracking form still sends the number to
`my.dxdelivery.com/query?tracking_number={number}`. That address redirects to
`my.dxdelivery.com/t/{number}`, the form DX's delivery emails link to.

## Why there is no adapter

The page at `my.dxdelivery.com` reads its routing patterns from `/jsoptions/` and posts the
lookup from its own script:

- Network Services: `POST /nstracking/trackinginfo` with `t`, the number alone. An unknown
  number gets HTTP 204; another shape gets HTTP 400 "Bad tracking number".
- Secure delivery: `POST /securedelivery/GetDelivery` with `t` and the delivery postcode `p`,
  then `POST /securedelivery/TrackingHistory` with `parameter[t]` and `parameter[p]`. A missing
  postcode gets HTTP 400; no match gets HTTP 204. The page's postcode pattern also accepts
  `IRELAND` for Irish deliveries.
- Freight: the page hands over to `dx-track.com/track/dx.aspx?consno={number}&postcode={postcode}`,
  an ASP.NET page that stores the lookup in a session and redirects to `Track.aspx`, or to
  `TrackingError.aspx`, whose notice gives an unknown number, a wrong postcode and a delivery
  more than 30 days old the same wording.

None of these needs a CAPTCHA. Akamai serves `my.dxdelivery.com` to Node's `fetch` and to a
full Chromium, sends curl a proof-of-work "Challenge Validation" page and refuses Chromium's
headless shell. The `dxlogistics.com` form's `/track-validation-check` checks only the number's
format.

Freight and secure lookups need the delivery postcode, and without one the service says
nothing about the number. The public sample numbers carry no postcode, so the result pages
could not be observed, and no public twelve-digit Network Services number was found. DX
publishes no consumer tracking app. An adapter can take the postcode as an optional input once
a live number with its postcode shows those pages.

## Testing

Provider live-test inputs and commands are in the [provider READMEs](../../providers/README.md).
