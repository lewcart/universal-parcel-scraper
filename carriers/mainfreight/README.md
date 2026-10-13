# Mainfreight

Mainfreight shipments use enabled universal providers. There is no dedicated adapter.

## Numbers

Mainfreight's tracker takes consignment, job and reference numbers from several services. New
Zealand, Australian and American transport consignments are eleven digits; air and ocean jobs
are the letter S and eight digits; older New Zealand and Australian consignments are three
letters and eight digits. Eleven digits are shared by many carriers, and the job layout is
common to freight forwarders on the same software, so no rule claims them.

## Links

The tracker reads a number from `trackingnumber` on `/tracking`, the address its own search
form builds. A tracked shipment opens at `/track/` followed by a service code and the number.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
