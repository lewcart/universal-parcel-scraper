# PBT

PBT consignments use enabled universal providers. There is no dedicated adapter.

## Numbers

PBT's tracker takes ticket and consignment note numbers. Its tracked consignments carry three
letters and seven or eight digits, and each item adds a three-digit suffix; tickets with two
letters and eight digits were also tracked. Other carriers print the same shapes, so no rule
claims them.

## Links

The tracker opens one consignment at `www.pbt.nz/tracking-result/` with the number in
`consignmentNumber`. The library also reads numbers from the former `results.cfm` lookups on
`pbt.com` and `pbt.co.nz`, which took `ticketNo`, and from the former `pbt.co.nz/landing.aspx`,
which took `track`.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
