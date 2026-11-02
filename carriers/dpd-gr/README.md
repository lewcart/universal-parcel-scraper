# DPD Greece

DPD Greece parcels use enabled universal providers. There is no dedicated adapter.

DPD Greece is the DPD network's national carrier in Greece. Its site, www.dpd.gr, opens its
tracker at services.dpd.gr, the same Speedy platform page DPD Romania's tracker uses.

## Numbers

DPD Greece publishes no waybill format, and no public page shows one of its waybills, so there is
no rule.

## Why there is no adapter

services.dpd.gr serves a Cloudflare challenge before its tracker. DPD Romania's adapter reads
the anonymous endpoint behind MyDPD instead. DPD Greece runs the same MyDPD at mydpd.dpd.gr, whose
tracker script asks the same `/rest/public/track?id=<waybill>&language=en` path without a key or
cookie. It answers a made-up waybill with HTTP 404 and MyDPD's "the requested resource does not
exist" page, the page it also gives a path that does not exist, as DPD Romania's MyDPD gives its
own not-found page for both. No DPD Greece waybill has been seen, so no answer for a shipment
has been, and the adapter waits for one to confirm the path and its reply.

## Links

Tracking links carry the number as `shipmentNumber`, on the `tracking` page of services.dpd.gr or
on the `track-shipment` page of www.dpd.gr.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
