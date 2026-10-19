# AIT Worldwide Logistics

AIT Worldwide Logistics shipments use enabled universal providers. There is no dedicated
adapter.

AIT is a US logistics company with a home delivery service. Its FasTrak page shows a shipment's
progress and invites the recipient to schedule the delivery.

## Numbers

Archived FasTrak lookups show AIT bill numbers of seven to nine digits; the former tracker
accepted up to ten characters. Bare digit runs of these lengths are shared by many carriers, so
no rule claims them, and a caller names the carrier or pastes a FasTrak link.

## Links

The tracking box on AIT's website sends the number as `trackingnumber` to
`fastrak.aitworldwide.com`, so `fastrak.aitworldwide.com/?trackingnumber={number}` opens one
shipment. Archived lookups spell the parameter `TrackingNumber`; the library reads the number
from either.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
