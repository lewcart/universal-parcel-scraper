# Bulgarian Posts

Bulgarian Posts parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

International items carry UPU S10 numbers, which generic postal detection handles; the country
code at the end names the post that issued them. Bulgarian Posts' tracking page says e-packages
and domestic items carry thirteen letters and digits starting `PS`, which `bulgarian-posts-1`
claims.

The tracking page follows an outbound item until it leaves Bulgaria and an inbound one from its
arrival.

## Links

The tracking page reads the number from `itemid` on `bgpost.bg/postal-services/track-package`
and its English twin, so that address opens one item. The former IPS Web tracker took the same
parameter on `bgpost.bg/IPSWebTracking/IPSWeb_item_events.asp`.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
