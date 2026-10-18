# BJS Home Delivery

BJS Home Delivery parcels use enabled universal providers. There is no dedicated adapter.

BJS Home Delivery is a British two-man home delivery service for large items that high-street
retailers sell.

## Numbers

A consignment number is `B`, seven digits, a dash and four digits. Thousands of archived
lookups on BJS's tracker use this layout. Detection reads it without the dash, as `B` and
eleven digits. `bjs-home-delivery-1` suggests BJS for that shape with low confidence, because
numbers of the same shape also come from outside BJS's network, and Colis Privé's generic
twelve-character rule accepts it too.

## Links

The tracker reads the number from its `parcel-id`, `OrderReference` or `order-number`
parameter, so `track.bjshomedelivery.com/?parcel-id={number}` opens one consignment. Older
links pass `parcel-id` to the company's home page.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
