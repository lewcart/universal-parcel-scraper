# WanbExpress

Tracks WanbExpress's own parcel identifiers through `tracking.wanbexpress.com`.
A direct HTTP lookup is tried first; a refused session can recover through the optional
TRAWL service. HTTP recognition never starts a browser.

The scoped browser helper observes tracking responses before opening the blank form. A deep link
can select the checkbox-only configuration. It tries the page's
checkbox with TRAWL's reCAPTCHA solver, then the passive V3 flow while the public page still
advertises that configuration. The carrier must accept `/Home/CaptchaVerify` before another
tracking request is made. CAPTCHA tokens, cookies and the rendered page stay in the isolated
context; the adapter reads only bounded responses for the complete requested identifier.
A final rejection remains a challenge even when an earlier reply succeeded.

The tracking reply must name the requested parcel and identify a parcel-ID match. Reference
and delivery-number matches stay inconclusive. Only the explicit unknown-parcel envelope is
not-found. Scans carry UTC instants; their display offsets are not applied a second time.
Recipient details, proofs of delivery and photographs are excluded.

Verification depends on the browser and its network. A datacenter network can be rejected by
both reCAPTCHA flows; enabled universal providers then take over. An accepted CAPTCHA alone
never establishes that tracking succeeded.

Set `WANBEXPRESS_TRACKING_NUMBER` and `FLARESOLVERR_URL` outside the repository and run
`npm run test:carriers:live -- carriers/wanbexpress/adapter.live.test.ts`.
