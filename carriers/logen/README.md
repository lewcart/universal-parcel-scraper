# Logen

Logen parcels use enabled universal providers. There is no dedicated adapter.

Logen (로젠택배) is a South Korean parcel network.

## Numbers

Logen waybills are eleven digits, printed in groups of three, four and four with hyphens. The
tracker asks for the eleven digits without hyphens. In archived lookups on Logen's trackers
the last digit is the first ten digits modulo 7, the check Japan Post, Yamato, Sagawa and
other Korean carriers use too. Eleven digits with that check are printed by many carriers, so
no rule claims them.

## Links

The tracking form opens `www.ilogen.com/web/personal/trace/{number}`, and the mobile site
`/m/personal/trace/{number}`. Archived lookups also use the mobile pop-up
`/m/personal/trace.pop/{number}`, the former `iLOGEN.Web.New/TRACE/TraceView.aspx` page with
the number in `slipno`, and the older `d2d.ilogen.com` tracker, which now fails.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
