# DEX Pakistan

Tracks DEX Pakistan's own parcels through its public guest JSON API. The adapter
restores the printed hyphen removed by normalization, searches for the whole
number, then reads its timeline. Both replies must identify the requested
number and the Pakistan DEX network; the history must also name Pakistan.

The [official tracker](https://www.dex.com.pk/tracking) and its
[request builder](https://g.alicdn.com/logistics-fe/dex-web/1.1.0/js/tracking.js)
use `POST /api/search_packages` with `trackingNumbers`, followed by
`POST /api/get_package_history` with `trackingNumber`. The initial history read
needs no session, phone digits or CAPTCHA. Phone verification opens delivery
images, which the adapter does not request or retain.

Scan times are epoch milliseconds, preserved as instants. Statuses use the
official client's code map; bookkeeping notices retain the preceding shipment
stage. Empty histories and timelines missing their current status remain partial
so enabled providers can supply missing scans. Recipient details, images and
proof-of-delivery data are discarded.

`DEX_PK_TRACKING_NUMBER=... DEX_PK_ARCHIVED_TRACKING_NUMBER=... DEX_PK_UNKNOWN_NUMBER=... npm run test:carriers:live -- carriers/dex-pk/adapter.live.test.ts`
