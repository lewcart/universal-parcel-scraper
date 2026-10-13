# Optional TRAWL browser service

Some carriers and universal providers only answer a full browser session. This image extends
[TRAWL](https://github.com/germondai/trawl) with identity-bound capture for DHL Express, FedEx, UPS, Royal Mail,
Australia Post, YunExpress, 17TRACK, SF Express, WanbExpress, XPO, Asendia and DHL Poland. The adapter checks the captured response against
the requested parcel. A solved challenge alone is not tracking history.

Spee-Dee also uses the service's HTTP tier after a refused direct connection; the benefit
is the service's network, and no browser is launched. Dingxiang (ZTO) and MTCaptcha
(Hongkong Post) need carrier-specific handling that this image's solvers do not provide.
Their [ZTO](../carriers/zto/README.md) and [Hongkong Post](../carriers/hongkong-post/README.md)
documentation describes the verification flows.

## Sessions

The service reuses browser sessions, never parcel responses. FedEx keeps one verified context
per pooled browser and discards it on expiry, mismatch or failure. Australia Post,
DHL Express, SF Express, WanbExpress, XPO, Asendia and DHL Poland use fresh contexts.
DHL Poland submits its history form after reCAPTCHA verification and returns only
the waybill and scan fields, excluding recipient acknowledgements and verification tokens.
Its [image classifier](dhl-poland-model/README.md) runs locally in a bounded worker;
no paid CAPTCHA service or model API is required.
Asendia waits for its own Turnstile callback to enable search and binds the captured POST
to one whole identifier. Given a delivery postcode in the fragment, it opens the scans through the page's dialog; otherwise recipient verification leaves the current status only. XPO scopes the checkbox
solver to its visible widget while the public client completes verification and tracking.
DHL Express waits for the public
page to complete verification and repeat tracking after an intermediate HTTP 428.
17TRACK submits a supplied postcode through the site's form and binds the capture to
the number and postcode in its outgoing request.
UPS binds the browser POST to one tracking ID and retains the latest bounded
response sequence, including refusals after the body extraction budget is spent.

Redis is optional. It stores cookies and user agents with a TTL, not tracking history, and a
cached session that fails falls back to a fresh browser. Do not expose Redis.
Keeping a browser session does not make an application CAPTCHA token reusable;
the site can require fresh verification for each action.

## Run it

```sh
docker build -t universal-parcel-scraper-trawl trawl
```

Keep the service on a private network. Pass its URL as `trawlUrl` to the library, or as
`FLARESOLVERR_URL` to the CLI and the HTTP server. `TRACKING_CHROMIUM_PATH` enables the
separate local Chromium transport.

`REDIS_URL` configures the session cache. `AUSTRALIA_POST_BROWSER_LOCALE` overrides the
browser locale for Australia Post, and `FFMPEG_PATH` selects SF Express's PNG decoder.

The image sets `LOG_LEVEL=warn`. TRAWL's request log includes the page path, where some
carriers put the parcel number; `LOG_LEVEL=info` turns that log on.

TRAWL drops a reply that reaches its request deadline. The image ends its own waits and
TRAWL's CAPTCHA solvers 2.5 seconds before it, so a page behind an unsolved widget and
the replies already captured are still returned.

## Tests

`npm run test:scripts` runs the offline capture and session tests. Live adapter tests need a
running browser service and references supplied through the environment. Browser challenges
and upstream limits can still prevent retrieval.

## Upstream releases

A nightly workflow builds this image on each new TRAWL release and reports in an issue
whether the patches still apply. `node scripts/trawl-upstream.mjs --write` moves the pins
to that release. Compare the service's answers with the pinned release before deploying:
a build does not show a changed deadline or a field missing from a reply.

## License

This derivative is [AGPL-3.0](LICENSE), separate from the core package's Apache license.
[Matching source and redistribution](SOURCE.md).
