# Pullman Cargo

Pullman Cargo parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Pullman Cargo, a Chilean cargo and parcel carrier, tracks a shipment by its eleven-digit
transport order number (ODT). Detection does not offer it, since eleven digits are shared with
many carriers' numeric waybills.

## Links

The tracker at `pullmancargo.cl/seguimiento` opens an order at `/seguimiento/` followed by the
ODT, as the site's own form builds it.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
