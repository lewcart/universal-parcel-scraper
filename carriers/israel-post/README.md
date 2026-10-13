# Israel Post

Israel Post parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Israel Post's search page says its item numbers have thirteen characters. Registered, EMS
and ECO POST items carry UPU S10 numbers ending `IL`, which generic postal detection offers.
Its courier service numbers items with eleven digits and `IL`, which `israel-post-1` claims;
archived lookups on the tracker show both layouts. Other layouts looked up there, such as
eleven digits and `RG`, are not described and stay unclaimed.

## Links

The tracker reads the number from `itemcode` on its Hebrew tracking page, often with
`OpenForm` and a language parameter, so that page with `?OpenForm&itemcode={number}` opens one
item. The earlier tracker under `itemtrace.nsf` took the same parameter and now redirects. The
site refuses requests from many networks, and results load only after a CAPTCHA.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
