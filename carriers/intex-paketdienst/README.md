# INTEX Paketdienst

INTEX Paketdienst parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

INTEX Paketdienst is a German parcel service for valuables and direct deliveries. An archived
lookup on its tracker shows a shipment number of seven digits, a hyphen and one more digit.
Without the hyphen it is eight digits, a length several carriers share, so no rule claims it.

## Links

INTEX's tracking form sends the number as `sdnr` to `intex-paketdienst.de/sendungsstatus/`,
so `intex-paketdienst.de/sendungsstatus/index.php?sdnr={number}&mid=1` opens one shipment.
The home page form sends `sdnr` to `intex-paketdienst.de/website/tracking.html`. The library
reads the number from both.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
