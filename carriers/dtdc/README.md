# DTDC

Tracks shipments available in the official MyDTDC consumer feed.

## How it works

One anonymous GET returns the current state and scan history. The returned
consignment must contain the requested booking reference or waybill. Related
forward and return scans stay on their own legs, and the current state remains
a separate dated snapshot when it is absent from the scan list.

Return booking and movement keep active stages so later progress can be synced.
Only delivery on the return leg completes the return; it does not set a recipient
delivery time.

## Limitations

Some legacy consignments are unavailable in this feed. Its generic failure
message does not prove that a number is unknown. Recipient details, addresses,
booking information and unlabelled weight values are excluded.

Published legacy references can suggest DTDC without establishing that the
current feed retains their history. Detection keeps that distinction for legacy
waybills of one letter and eight digits: `N` waybills are selected, and the
other letters DTDC's former tracker is known to have answered are only
suggested. `A` waybills are left out: one DTDC reply shows one, and a Day & Ross
sample shares the shape.

## Testing

Set `DTDC_TRACKING_NUMBER` outside the repository and run
`npm run test:carriers:live -- carriers/dtdc/adapter.live.test.ts`.
