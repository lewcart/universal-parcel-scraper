# OCASA

OCASA parcels use enabled universal providers. There is no dedicated adapter.

OCASA is an Argentine logistics and courier company that delivers many Mercado Libre parcels.
OCA, the separate `oca` carrier, is a different company with its own tracker.

## Numbers

OCASA's tracker answers several layouts. `EC2` or `EC3` followed by two to four letters and six
to eight digits, thirteen characters in all, appears in archived lookups, and the tracker shows
the Mercado Libre shipment behind it. No other carrier's numbers take that form, but no OCASA
page explains the code and it may come from Mercado Libre, so `ocasa-1` suggests OCASA for it
with low confidence. Eleven digits are Mercado Libre shipment numbers, which other carriers
deliver too and whose shape many carriers share, so no rule claims them. Three letters and ten
digits starting `ECO`, `TCF` or `PST` were also looked up; `TCF` came from one merchant's
shipments, the others are unexplained, and `PST` numbers fall inside Bulgarian Posts' `PS`
rule, so none of them gets a rule.

## Links

OCASA's tracking form sends the number as `airbillnumber` to
`tracking.ocasa.com/Tracking/index`, which asks for a CAPTCHA before it shows the parcel.
Archived lookups also use `tracking.ocasa.com/TrackingOnline/index` and the former
`tracking.ocasa.com/tracking.aspx` with the same parameter.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
