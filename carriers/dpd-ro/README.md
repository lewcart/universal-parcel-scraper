# DPD Romania

DPD Romania parcels use enabled universal providers. There is no dedicated adapter.

DPD Romania belongs to the Speedy group, and its customer API mirrors Speedy's. Its domestic
waybills track only on DPD Romania's tracker, not on the DPD group tracker the `dpd` entry
uses. Parcels it hands to the DPD network abroad also carry a DPD group parcel number, which
the `dpd` entry covers.

## Numbers

DPD Romania waybills, return waybills included, are eleven digits starting with 8. Lookups
archived from DPD Romania's tracker and an open-source tracking library's test show them.
Eleven digits are shared with Speedy and many other carriers, and nothing in the number points
to DPD Romania, so no rule claims them. The tracker also takes the fourteen-digit DPD group
parcel number of a parcel handed to the DPD network, which it shows beside the waybill as the
partner network's number, and it shows Speedy waybills of shipments between Bulgaria and
Romania.

## Links

`tracking.dpd.ro/?shipmentNumber={number}` opens one parcel; DPD Romania's home page widget and
its shop plugins build it. The address redirects to `services.dpd.ro/tracking/`, which reads
the same parameter. Both serve a Cloudflare challenge to scripts.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
