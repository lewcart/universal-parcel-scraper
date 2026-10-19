# AnserX

AnserX parcels use enabled universal providers. There is no dedicated adapter.

AnserX (斑头雁国际物流) is a Shenzhen cross-border logistics company with dedicated lines from
China. Its tracker labels both the AnserX number and a delivery number (派送单号), the number
of the carrier that delivers the parcel at destination.

## Numbers

The AnserX number seen is `BTY`, `CN`, ten digits and `YQ`, in an address of AnserX's own
tracker. The tracker calls these BTY numbers its own, so rule `anserx-1` claims the layout
with high confidence. Delivery carriers' numbers stay with their carrier.

## Links

The tracker on `oms.anserx.com` reads the numbers it shows from `nos` on `/tracking`,
separated by commas, and the home page's search opens that address, so
`oms.anserx.com/tracking?nos={number}` opens one parcel.

## Retrieval

The tracker loads its result from `oms.anserx.com/client/cs/anserxWebsite/tracking/getTrackInfo`
with `nos` and `internalFlag=0`. The reply is JSON and needs no cookie, token or CAPTCHA; each
scan has an English and a Chinese wording, a place and a time without offset.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
