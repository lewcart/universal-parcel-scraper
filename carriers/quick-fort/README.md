# Quick Fort

Quick Fort parcels use enabled universal providers. There is no dedicated adapter.

Quick Fort (速丰捷运国际物流有限公司) is a Hong Kong forwarder that carries express, air and road
freight between mainland China, Hong Kong and abroad. Its site is www.quick-fort.com.

## Numbers

The one parcel the app has seen carries QFT and twelve digits, and 17TRACK filed its whole
history under Quick Fort. No public number has been found, so `quick-fort-1` has low confidence
and the corpus holds a synthetic one.

## Why there is no adapter

None is built yet. Its tracker opens a page per number at
`/search_kuai_di/search/orderid/{number}` and answers a number it does not hold with a notice
that no order was found.

## Links

Tracking links carry the number in the path of that page.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
