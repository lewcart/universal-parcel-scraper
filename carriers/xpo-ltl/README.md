# XPO

XPO freight shipments use enabled universal providers. There is no dedicated adapter.

## Numbers

XPO PRO numbers are nine digits, the last a check digit per XPO's help pages. Nine digits are
shared with several carriers, so no rule claims them.

## Links

The tracking field on `xpo.com` hands PRO numbers to XPO's public LTL tracker, which reads them
from `?referenceNumber=` on `ext-web.ltl-xpo.com/public-app/shipments`. Guest results sit
behind a captcha.

## Testing

Provider live-test inputs and commands are in the [provider READMEs](../../providers/README.md).
