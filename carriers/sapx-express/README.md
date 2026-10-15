# SAPX Express

SAPX Express parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

SAPX resi numbers seen on its own tracker are three letters for the origin branch or client
followed by thirteen or eleven digits; the tracker's own hint starts them with `CGK`. The
tracker also takes Tokopedia booking codes that start with `TKP01-`, and complaints name a
twelve-digit number for a bank card delivery. Three letters and digits are printed by several
other carriers, booking codes belong to Tokopedia and twelve digits are common, so no rule
claims these layouts.

## Links

SAPX's tracker opens one parcel at `www.sapx.id/id/cek-awb/{number}`; the earlier
`sap-express.id` host, which now redirects to `sapx.id`, used the same path and before that
`/layanan/tracking/details/{number}`. The library reads the number from these addresses.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
