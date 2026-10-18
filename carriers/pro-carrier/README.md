# Pro Carrier

Pro Carrier parcels use enabled universal providers. There is no dedicated adapter.

Pro Carrier, formerly DG, is a UK freight and cross-border e-commerce delivery business. Its
tracker shows each parcel under Pro Carrier's number together with the partner carrier that
moves or delivers it, such as Royal Mail or Colis Privé, and links to that partner's tracker.

## Numbers

Lookups archived from its tracker show `DG` and eleven digits from the DG years, which
`pro-carrier-1` suggests. Two characters and eleven digits is also La Poste's family, and its
low-confidence rule takes them too, so neither rule names a carrier alone. A recent parcel uses `UBG` and nine digits, the layout of Purolator's rule;
one sample does not establish the family, so no rule claims it. The tracker also answers for
the labels of the carriers a parcel travels with: Royal Mail labels for domestic parcels,
`JJD` labels, USPS labels on returns from the US and Fast Despatch Logistics numbers. Those
stay with their own carriers' rules.

## Links

The tracker at `tracking.weareprocarrier.com` reads the number from `tn`, so
`tracking.weareprocarrier.com/?tn={number}` opens one parcel. An integration guide prints the
address with a doubled slash before the query, which opens the same page.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
