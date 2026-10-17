# FedEx Poland

FedEx Poland parcels use enabled universal providers. There is no dedicated adapter.

FedEx Poland is FedEx's domestic courier network in Poland, the former Opek that FedEx Express
bought. Its shipments have their own tracker, apart from FedEx's worldwide tracking page that
`fedex` reads: FedEx's Polish domestic tracking page embeds an app from
`fds2tracking.emea.fedex.com`, which asks a tracking service on `poland.fedex.com`.

## Numbers

Domestic shipments carry thirteen-digit numbers, the only form the domestic tracking app
accepts. Archived lookups on the current and former domestic trackers show them with scans at
Polish branches. They start with 6 and end in a GS1 check digit, which does not set them apart
from other carriers' thirteen-digit numbers, so no rule claims them and detection does not
offer FedEx Poland. No FedEx rule takes thirteen digits.

## Links

The domestic tracking app opens one shipment at
`#/preview?packages={number}&trackingKey={number}`, on `fds2tracking.emea.fedex.com` or on the
FedEx page that embeds it, `fedex.com/pl-pl/online/domestic-tracking.html`. Archived lookups
on the former tracker use
`poland.fedex.com/domestic-shipping/pub/tracktrace.do?packageId={number}`. All are read for
FedEx Poland.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
