# Relay

Relay parcels use enabled universal providers. There is no dedicated adapter.

Relay, run by Relay Technology, delivers marketplace and retailer parcels in the UK, Vinted's
among them, through its own couriers. Its tracking page asks for the tracking ID and the
delivery postcode, and opens no parcel from the number alone.

## Tracker

The page hands the ID and postcode to `track.relaytech.co`, whose app reads the delivery from
`GET https://relay-production.relaytechapis.co/v0/customer-portal/shipments/{ID}?postcode={postcode}`
without a key, cookie or CAPTCHA. Without the delivery postcode it opens nothing: an unknown ID
and a missing or wrong postcode get the same 404, "No order was found for that tracking number",
so that answer does not show a parcel is missing. Return numbers starting `RET` open from the
number alone at `…/inbound-shipments/{number}`; the app uses that route for returns only. An
adapter would take the postcode as a requirement, as Colis Privé's does.

## Numbers

Relay's tracking IDs are `RELR` and eight capital letters and digits. Colis Privé's
twelve-character rule also takes that shape, but no other carrier's numbers start with Relay's
prefix, so `relaytech-1` claims them. The sample and its source are in
[`numbers.json`](numbers.json).

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
