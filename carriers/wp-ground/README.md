# WP Ground

WP Ground parcels use enabled universal providers. There is no dedicated adapter.

WP Ground (WPG) delivers large and bulky parcels on the last mile in the United States and Canada,
from hubs in Los Angeles, Miami, Dallas, Chicago and New York. Its site is www.wpglogis.com.

## Numbers

WP Ground publishes no number format, and no public page shows one of its tracking numbers, so
there is no rule.

## Why there is no adapter

None is built yet. Its tracker posts the numbers, separated by commas, as `trackNumberList` to
`/api/trackQuery` on www.wpglogis.com, with no key or session. Its proof-of-delivery photos open
only after the recipient's name is checked.

## Links

Tracking links carry the number as `ext_trackingNumber` or `trackingId` on the `tracking` page of
www.wpglogis.com.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
