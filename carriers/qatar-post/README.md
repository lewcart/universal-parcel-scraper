# Qatar Post

Qatar Post parcels use enabled universal providers. There is no dedicated adapter.

Qatar Post (Q-Post, بريد قطر) is the national post of Qatar.

## Numbers

International items carry UPU S10 numbers ending in QA, which generic postal detection handles.
No other Qatar Post format has a public sample, so no rule offers Qatar Post.

## Links

The tracker at `www.qatarpost.qa/TrackAndTrace` reads the number from `?trackingNumber=` and looks
it up when the page opens, so that address opens one parcel.

## Why there is no adapter

The page's lookup, a form POST to `/TrackAndTrace/_TrackAndTraceOrderDetails`, carries a
reCAPTCHA v3 token the page requests when it opens. A plain HTTP client has no such token.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
