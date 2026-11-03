# Topnic

Topnic parcels use enabled universal providers. There is no dedicated adapter.

Topnic (Topnic Logistics Limited, Hong Kong) ships online shops' orders from China to the UK, the
US and Europe, with warehousing and fulfilment. Its site is topnic.com.hk.

## Numbers

Topnic publishes no number format, and no public page shows one of its tracking numbers, so there
is no rule.

## Why there is no adapter

Its order tracking page at `/order-tracking/<number>` reads an open JSON endpoint,
`oms-api.topnic.com.hk/api/delivery/tracking?trackingNumber=<number>`, without a session or
CAPTCHA, which answers an unknown number with `trackingEvent: null`. The page shows a found
`trackingEvent`'s order number, origin, destination and dated events. No public number is known to
see a found reply.

## Links

A topnic.com.hk link to `/order-tracking/<number>` names Topnic. A link holding several numbers is
not read.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
