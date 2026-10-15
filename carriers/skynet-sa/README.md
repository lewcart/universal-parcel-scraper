# SkyNet South Africa

SkyNet South Africa parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

SkyNet South Africa is the South African member of the SkyNet Worldwide Express network and
runs its own domestic courier tracker. When SkyNet's WooCommerce plugin books a parcel it
offers the client's SkyNet code with the shop's order number, and SkyNet returns the waybill
number. Waybills mix letters and digits in shapes other carriers share, so no rule claims them.
International SkyNet shipments use the network's shared tracker, covered by SkyNet Worldwide
Express.

## Links

SkyTrack reads a waybill number from `R` on `web.skynet.co.za:5002/T`; SkyNet's WooCommerce
plugin links each booked waybill there, so one parcel opens at
`web.skynet.co.za:5002/T?R={number}`. The older tracker read it from `wb` on
`www.skynet.co.za/tracking2/tracking.aspx`.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
