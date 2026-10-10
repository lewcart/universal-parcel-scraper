# Hrvatska pošta

Hrvatska pošta items use enabled universal providers. There is no dedicated adapter.

## Numbers

Lookups archived from Hrvatska pošta's tracker show S10 numbers ending `HR`, one typed in lower
case, and S10 numbers of other posts. The tracker's own script also accepts SSCCs, twelve-digit
numbers and other barcode layouts, which the archived lookups do not show. International items
use the UPU S10 layout and stay with the generic postal carrier.

## Links

Hrvatska pošta's tracking forms, on `posiljka.posta.hr` and on `www.posta.hr`, send the number
as `barcode` to `posiljka.posta.hr/hr/tracking/trackingdata`, which opens one item. The same
page also answers at `/en/tracking/trackingdata` and `/tracking/trackingdata`.

## Testing

Provider live-test inputs and commands are in the [provider READMEs](../../providers/README.md).
