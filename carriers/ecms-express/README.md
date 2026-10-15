# ECMS Express

ECMS Express parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

ECMS tracking ids are sixteen characters: a two-letter family (EC, ES, AP or AX), letters
that name the lane or origin airport, and a serial, as three letters and eleven digits, four
letters and ten digits, or five letters and nine digits. ECMS's own tracker shows all of these
families, and no other carrier's numbers take that shape, so one high-confidence rule claims
them. Last-mile numbers the tracker shows after hand-over, such as USPS or YTO ones, stay with
their own carriers.

## Links

The tracking page reads the number from `orderNumber` on
`ecmsglobal.com/<locale>/tracking.html`, which the home page form builds, and asks an
arithmetic question before it shows the history. The consignee tracker at
`consignee.ecmsglobal.com/brige/showtracking` and the `oms/showtracking` page read it from
`trackingno`, and older `showtracking.html` pages read `order_number`.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
