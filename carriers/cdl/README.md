# CDL Last Mile

CDL Last Mile parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

CDL's tracker shows a CDL tracking number and the shipper's package reference, and takes
either. Lookups archived from it show nine digits, a hyphen and one digit (2022 to 2026), and
`CDL` followed by eleven digits (2026), which `cdl-1` claims. `cdl-2` offers CDL as a
low-confidence suggestion when the hyphenated number is typed with its hyphen; without it, ten
digits are shared with DHL and several other carriers. Package references starting `CDDL` with
eight digits (2022) and shippers' own references are not claimed.

## Links

The tracking box on `cdldelivers.com` opens
`apps.cdldelivers.com/Tracking-Page/track?id={number}`, which shows one parcel; the library
reads the number from such a link and builds it. The former tracker at
`ship.cdldelivers.com/Xcelerator/Tracking/Tracking` took `orderId` or `packageitemrefno` and
now redirects to the new page; the library reads both.

## Testing

Provider live-test inputs and commands are in the [provider READMEs](../../providers/README.md).
