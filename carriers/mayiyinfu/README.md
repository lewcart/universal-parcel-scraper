# Mayi Yinfu

Mayi Yinfu parcels use enabled universal providers. There is no dedicated adapter.

Mayi Yinfu (广东蚂蚁银服国际物流有限公司) is a Guangdong forwarder of express and small parcels
from China. It flies parcels to the destination region and hands them to a delivering carrier,
such as Deutsche Post DHL into Europe. Its tracker runs on the Hualei (华磊) forwarder platform
also used by [GZYL](../gzyl/README.md), and shows the delivering carrier's number with its
scans.

## Numbers

Its tracking numbers are MY, ten digits and US, MY standing for 蚂蚁 (Mayi). The suffix does
not name the destination. The shape is fixed and no other carrier's rule takes it, so the rule
has high confidence. No public number has been found, so the corpus holds a synthetic one.

## Links

`www.mayiyinfu.com.cn:8082/trackIndex.htm?documentCode={number}` opens one parcel on the
carrier's tracker. The tracker answers plain HTTP only, so no portal link is published.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
