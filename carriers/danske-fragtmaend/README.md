# Danske Fragtmænd

Danske Fragtmænd consignments use enabled universal providers. There is no dedicated adapter.

## Numbers

Danske Fragtmænd's FAQ says a consignment note number is two letters and six digits; its
integration guide and archived tracker replies show the same layout. Each parcel also carries a
collicode of twenty digits followed by the consignment note number, which the tracker accepts
too.

`danske-fragtmaend-1` claims the collicode, which no other carrier prints. No rule claims the
consignment note number on its own: two letters and six digits also fit other carriers'
numbers, the eight characters the three GLS networks print among them.

## Links

Danske Fragtmænd's integration guide documents `trace.fragt.dk/{number}` for a consignment note
number and `trace.fragt.dk/colli/{collicode}` for a parcel, so both open one consignment.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
