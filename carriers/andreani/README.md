# Andreani

Andreani parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Andreani shipment numbers are fifteen digits starting `36000`, `31000` or `30000`. Lookups
archived from Andreani's tracker and from the tracking service behind it show all three. No
rule claims them: detection compares numbers with spaces and hyphens stripped, and fifteen
digits are then a plain digit run other carriers print too. Older lookups also show fifteen
digits starting `90000` and lettered references of merchants, which stay unclaimed as well.

## Links

Andreani's notification emails link one shipment at `andreani.com/envio/{number}`, and archived
lookups use the same path on `seguimiento.andreani.com`. The library reads the number from those
addresses but builds none, because the site blocks automated checks of its search page.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
