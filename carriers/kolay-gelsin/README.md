# Kolay Gelsin

Kolay Gelsin parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Customers quote twelve-digit tracking numbers, most starting `26`. Twelve digits are shared
with Yurtiçi Kargo, DHL eCommerce Türkiye and others, so no rule claims them. A sender also
quotes a fourteen-digit number, a shape customers quote for HepsiJET too. Nine- and
sixteen-digit numbers whose role is unclear are kept as quarantined evidence. Sendeo's former
numbers have the same twelve-digit shape. Before the Sendeo platform, Kolay Gelsin's e-branch
tracker used two letters and seven digits, or one letter and six digits; these short shapes are
too generic to claim.

## Links

The tracker at `kolaygelsin.com/tracking` takes a tracking or order number behind a Cloudflare
Turnstile check, and no address that opens one parcel is known.

The public form waits for Turnstile's callback, then posts `trackNumber`, `captchaCode`
and `isRedirected` to `/api/shipment/check`. Missing verification returns HTTP 399, which
is a challenge rather than a missing parcel. The resulting redirect can contain an opaque
query capability; it is not a reusable public tracking link. The separate `kgHistory`
route requires a verification code. A browser must complete the public form before its
tracking response can establish the available anonymous history.

The official [Android app](https://play.google.com/store/apps/details?id=com.kolaygelsin.ebranchandroid)
opens the same tracking page in a web view. Its native support and OTP services are
separate from shipment tracking. App deep links add `redirected=true`; this does not
replace the tracking verification or create a result capability.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
