# DPD Greece

DPD Greece parcels use enabled universal providers. There is no dedicated adapter.

DPD Greece is the DPD network's national carrier in Greece. Its site, www.dpd.gr, opens its
tracker at services.dpd.gr, the same Speedy platform page DPD Romania's tracker uses.

## Numbers

DPD Greece publishes no waybill format, and no public page shows one of its waybills, so there is
no rule.

## Why there is no adapter

services.dpd.gr serves a Cloudflare challenge before its tracker. DPD Romania's adapter reads
the anonymous endpoint behind MyDPD instead; no such endpoint is known for DPD Greece.

## Links

Tracking links carry the number as `shipmentNumber`, on the `tracking` page of services.dpd.gr or
on the `track-shipment` page of www.dpd.gr.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
