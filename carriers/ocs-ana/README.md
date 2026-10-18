# OCS ANA Group

OCS ANA Group parcels use enabled universal providers. There is no dedicated adapter.

OCS (Overseas Courier Service) is the ANA group's international express courier, based in
Japan.

## Numbers

OCS tracks a shipment by its waybill (CWB) number. Lookups archived from its tracker show
eleven-digit waybills for exports from Japan and twelve-digit waybills for imports into
Japan. Most of them end in an airline-style check digit (the leading digits modulo 7), as
the numbers of Blue Dart, Yamato and Sagawa do, and OCS's lookup hands some twelve-digit
numbers to Yamato or Sagawa. Neither length points to OCS alone, so no rule claims them.

## Links

The carrier's site opens its lookup on `www2.ocsworldwide.net` with the waybill as `cwbno`.
The lookup sends OCS waybills to the history page on `webcsw.ocs.co.jp`, which also takes
`cwbno`, and sends numbers of Japanese delivery partners to those carriers' trackers. Both
addresses accept several comma-separated numbers.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
