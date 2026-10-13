# Pósturinn

Pósturinn parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Pósturinn's items carry UPU S10 numbers ending `IS`, domestic parcels included, as archived
lookups on its tracker show. Generic postal detection handles them, so no rule is needed. The
tracker also follows inbound items under the number the sending post issued.

## Links

The tracking page reads the number from `q`, which the home page's search box sets, or from
`TrackingNumber`, which older lookups used.
`posturinn.is/einstaklingar/mottaka/fylgstu-med-sendingunni-thinni/?q={number}` opens one item;
the former Icelandic path and the English pages take the same parameters.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
