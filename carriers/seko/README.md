# SEKO Logistics

SEKO parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

SEKO's eCommerce parcels run through its OmniParcel platform. Its API guide and sample
tracking file give consignment numbers of three letters and seven digits, and package barcodes
that add a two-digit package counter. A Trustpilot review gives a shipping number of the same
consignment layout, and a lookup archived from SEKO's tracker shows five letters and seven
digits. OmniParcel also carries postal S10 numbers, which belong to the postal network that
issued them.

Australia Post, Day & Ross and DSV share the consignment layout, and Purolator's rule claims
the package barcode's, so no rule claims SEKO numbers.

## Links

SEKO's tracking page reads one number or several from `?trackingNumbers=` on
`sekologistics.com/en/track/`. The OmniParcel tracker on `track.omniparcel.com` opens a
number from `?id=`, from its path, or from a path that puts a numeric site prefix and a hyphen
before it.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
