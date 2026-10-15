# Fargo Courier

Fargo Courier parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Archived lookups on Fargo's former tracking page show two waybill layouts: seven digits on
older waybills and `FCLIN` with eight digits on later ones, which the tracker matched in either
case. `fargo-courier-1` claims `FCLIN` and eight digits, a prefix no other carrier prints. No
rule claims the seven-digit waybills, a bare digit run many carriers share.

## Links

The home page's tracking form sends the number as `wayBill` to `/waybill-viewer/`, so
`fargocourier.co.ke/waybill-viewer/?wayBill={number}` opens one waybill. The former tracker
took it as `waybill_number`, on `/track-your-parcel` and on the home page.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
