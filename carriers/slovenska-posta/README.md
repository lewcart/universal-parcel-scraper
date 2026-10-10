# Slovenská pošta

Slovenská pošta parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Lookups archived from Slovenská pošta's former tracker between 2012 and 2025 show its own items
in the UPU S10 layout ending `SK`: registered items starting `R`, parcels starting `C`, EMS
items starting `E`, and others starting `B` or `L`. They pass the S10 check digit and stay with
the generic postal carrier, as do the foreign UPU numbers the tracker also answers.

## Links

The tracker at `www.posta.sk/sledovanie-zasielok` reads the number from the address fragment,
`#parcel={number}`, and the library reads it there. Lookups archived from the former
tracker put the number in `tandt.posta.sk/en/items/{number}` or as `q` on `tandt.posta.sk/`;
both now redirect to the new tracker without the number.

## Testing

Provider live-test inputs and commands are in the [provider READMEs](../../providers/README.md).
