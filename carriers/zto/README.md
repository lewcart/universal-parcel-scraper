# ZTO Express

Chinese domestic ZTO waybills use the [official tracker](https://www.zto.com/check).
Number shapes overlap other carriers; only a matching response confirms ownership.
ZTO International uses a separate network and tracker.

The adapter first posts to `hdgateway.zto.com/batchGetTrace`. A verification response
can fall back to the bundled TRAWL image. The page obtains a Dingxiang challenge
from `mapi.zto.com/captcha/image2`, solves a slider and, when requested, clicks
Chinese characters in order using local OCR. The page submits its own verification
token and repeats tracking in the same context. Tokens and recipient details stay
inside that context.

Verification can fail or exceed the lookup budget. Enabled universal providers
remain available for those failures and for fuller history: the public PC tracker
suppresses earlier traces even after verification. The adapter marks its history
as incomplete and keeps the carrier's epoch scan clocks.

HTTP recognition never starts a browser. ZTO takes no part in browser recognition:
the page's verification is not solved within a probe's budget, and most twelve-digit
numbers it would be asked about belong to FedEx, which issues the same shape.

The legacy image endpoint does not supply the page's plain-code challenge. Mobile
H5 tracking requires a signed-in ZTO account, and the Android app
(`cn.beekee.zhongtong`) protects its request implementation. The unauthenticated
ZTO International route does not establish domestic shipment ownership.

## Testing

Set `ZTO_TRACKING_NUMBER` and `FLARESOLVERR_URL` privately, then run
`npm run test:carriers:live -- carriers/zto`.
