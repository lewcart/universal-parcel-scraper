# Relay

Relay parcels use enabled universal providers. There is no dedicated adapter.

Relay, run by Relay Technology, delivers marketplace and retailer parcels in the UK, Vinted's
among them, through its own couriers. Its tracking page asks for the tracking ID and the
delivery postcode, and opens no parcel from the number alone.

## Numbers

Relay's tracking IDs are `RELR` and eight capital letters and digits. Colis Privé's
twelve-character rule also takes that shape, but no other carrier's numbers start with Relay's
prefix, so `relaytech-1` claims them. The sample and its source are in
[`numbers.json`](numbers.json).

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
