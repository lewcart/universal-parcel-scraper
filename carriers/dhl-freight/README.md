# DHL Freight

DHL Freight road consignments use enabled universal providers. There is no dedicated adapter.

## Numbers

DHL Freight's ActiveTracing searches by order code, consignment ID or package ID. Order codes
are three letters for the terminal, two for the product and seven digits, hyphenated. No rule
claims them: detection compares numbers with hyphens stripped, and the code is then five
letters and seven digits, which another carrier's numbers also fit. Package IDs (licence
plates) seen there are `JND` and seventeen digits; `dhl-freight-2` suggests DHL Freight for
them with low confidence, because licence plates of this kind follow a shared standard.
Consignment IDs are nine digits or, for domestic consignments, eleven digits with leading
zeros; digit runs like these are shared by many carriers, so no rule claims them.

## Links

ActiveTracing's search reads an order code or consignment ID from `a` on
`activetracing.dhl.com/DatPublic/datSelection.do` with `autoSearch=true` and
`search=consignmentId`, and a package ID from `valuePackageField`, as archived lookups show.
The details behind the history need the consignee's postcode and a security code.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
