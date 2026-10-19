# Chukou1

Chukou1 parcels use enabled universal providers. There is no dedicated adapter.

Chukou1 (出口易) is a Guangzhou cross-border logistics company with overseas warehouses and
direct lines from China. It hands its parcels to postal and last-mile carriers at
destination, and its tracker also accepts their numbers.

## Numbers

A Chukou1 processing number (处理号) is three letters naming the service, the date as six
digits, a three- or four-character customer code starting with a letter, and a six- or
seven-digit serial. Sellers give it to marketplaces as the tracking number with Chukou1 as
the carrier. Chukou1's API documentation shows this layout in its examples and archived
lookups on its tracker show more. Rule `chukou1-1` claims the layout with low confidence
because the service and customer codes vary. Shorter letter-and-digit inputs seen on the
tracker stay quarantined: the tracker also accepts partner numbers, so their owner is
unclear. Destination carriers' numbers stay with their carrier.

## Links

The tracker page `www.chukou1.com/LogistictsTrack.aspx` reads `trackNo` into its search box,
so `LogistictsTrack.aspx?trackNo={number}` opens one parcel once its captcha is solved.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
