# Best Transport

Best Transport parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Best's tracker asks for the shipment number. Archived lookups on it show thirteen characters
starting `DLT` and eight digits; Best does not publish its layouts. The tracker also answers
for some partners' shipments, so the `DLT` layout stays unclaimed, and eight digits are shared
by many carriers.

## Links

The tracker at `bst.nu` runs its search for the number in `search`, with or without a country
segment such as `/SE`, so `bst.nu/?search={number}` opens one shipment. A delivery page under
`bst.nu/{country}/{token}` uses a token, not the number.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
