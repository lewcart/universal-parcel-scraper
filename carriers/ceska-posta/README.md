# Česká pošta

Czech Post parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

- Domestic parcels carry two letters, ten digits and a letter. Archived Track & Trace
  results show `BA`, `BB` and `BX` parcels with real histories, and the tracker's help text
  gives a `DR` example. `ceska-posta-1` claims a `B` or `D` prefix in that layout. Nothing
  published explains the trailing letter, so no check is applied.
- International items use the UPU S10 layout ending in `CZ` and stay with the generic
  postal carrier.
- Balíkovna pickup parcels are run by Česká pošta. No Balíkovna number was found, so their
  layout is not covered.

## Links

Track & Trace opens a parcel at `postaonline.cz/trackandtrace/-/zasilka/{number}`.

## Testing

Provider live-test inputs and commands are in the [provider READMEs](../../providers/README.md).
