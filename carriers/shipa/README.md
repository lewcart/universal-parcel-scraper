# Shipa

Shipa parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Shipa Delivery tracking numbers are `SD` followed by nine digits. Customers quote them in
reviews that Shipa answers, and archived replies of the package service behind Shipa Delivery's
tracking page show their histories. `shipa-1` claims the layout. GLS Italy's broad rule also
accepts it, and the `SD` prefix decides.

## Links

`shipa.com/track/?trackingno={number}` opens one parcel: Shipa's tracking script reads the
number from `trackingno`. Links to Shipa Delivery's own tracking page carry a message code
rather than the tracking number, so the library reads no number from them.

## Testing

Provider live-test inputs and commands are in the [provider
READMEs](../../providers/README.md).
