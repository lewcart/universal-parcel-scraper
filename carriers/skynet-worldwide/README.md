# SkyNet Worldwide Express

SkyNet Worldwide Express shipments use enabled universal providers. There is no dedicated
adapter.

SkyNet Worldwide Express is a network of independently owned express couriers. Its members
share a tracker hosted by Frontier Force, which picks the network's branding from
`stid=skynet`. Skynet Malaysia shares the name but is a separate company, and aggregators often
mix the two.

## Numbers

SkyNet air waybills are mostly twelve digits, some with leading zeros; aggregators also show
eleven digits and lettered labels that may belong to Skynet Malaysia. None of these points to
SkyNet alone, so no rule claims them.

## Links

The tracker reads a number from `cn` on `tracking.skynetexpress.com/go/plm-tracking`, and from
the same path on `tracking.frontierforce.com`, where it redirects. The network's site at
`skynetworldwide.com` sits behind a bot challenge.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
