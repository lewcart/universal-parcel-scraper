# New Zealand Couriers

New Zealand Couriers parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

New Zealand Couriers, a Freightways courier, tracks several kinds of label. A courier ticket
or pack carries a product code of two or three letters and digits and a ticket number, which
the advanced tracker takes as two fields and the single search box as one entry with a space
or hyphen; the corpus writes archived tickets with a space. Charge labels carry eight digits
and international consignments nine. Customer printed labels pair the sender's account number
with a consignment number, so they are not kept. The track-a-parcel page gives the samples,
and archived lookups on the tracker give the tickets. Post Haste, another Freightways brand,
prints tickets in the same layout, and eight or nine digits are shared by many carriers, so no
rule claims them.

## Links

The search box sends a number to `nzcouriers.co.nz/track?query={number}`, whose script asks
Freightways for its history. The older servlet at `/nzc/servlet/ITNG_TAndTServlet` takes a
ticket as two parameters, so it is not read.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
