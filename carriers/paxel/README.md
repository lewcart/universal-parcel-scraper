# Paxel

Paxel parcels use enabled universal providers. There is no dedicated adapter.

Paxel (PT Global Unggul Mandiri) is an Indonesian courier for same-day and instant deliveries
within and between cities, collected and delivered by its own couriers.

## Numbers

A Paxel AWB is EM and a dot, ten capital letters and digits, then the shipment date, one digit
and six capital letters and digits, joined by hyphens. Paxel's blog and the tracker's
placeholder describe it. The library compares numbers without dots and hyphens, so `paxel-1`
claims EM, ten letters or digits, an eight-digit date starting with 20, one digit and six
letters or digits. No other carrier's numbers or rules use that layout.

## Links

`paxel.co/id/track-shipments?awb_req={number}`, the address archived lookups use, fills the
tracker's form with the number and submits it. The English page, `/en/track-shipments`, is the
same page.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
