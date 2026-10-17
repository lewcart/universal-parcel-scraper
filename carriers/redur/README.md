# Redur

Redur parcels use enabled universal providers. There is no dedicated adapter.

Redur is a Spanish parcel and pallet network with its own depots in Spain and Portugal. It
also carries shipments to the rest of Europe and hands them to partners there, such as
Ciblex in France.

## Numbers

Customers quote fourteen-digit shipment numbers in reviews on Redur's Trustpilot page and in
Portuguese complaints, and one review a seventeen-digit number. The tracker also finds a
shipment by its tracking number or by the sender's, the partner's or international
references. No rule claims these layouts: bare digit runs are shared with many carriers.
Partner numbers, such as Ciblex's, stay with those carriers.

## Links

The tracker form posts the number with a reCAPTCHA token, so no address of Redur's own opens
one parcel. Merchant links to `redur.es/track-trace/` carry the number in `valor`, with the
field in `buscarPor` and a client key, which is why no URL template is given.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
