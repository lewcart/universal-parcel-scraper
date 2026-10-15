# Dohrn Transfer

Dohrn shipments use enabled universal providers. There is no dedicated adapter.

## Numbers

Dohrn tracks less-than-truckload freight by its PRO number. An archived lookup on its own XML
trace shows an eight-digit PRO with its history. Eight digits are shared by many carriers, so
no rule claims them; a caller names the carrier or pastes a tracking page link. Since the
merger with Sutton, one Dohrn PRO covers freight moved by either company. The trace also finds
shipments by bill of lading, PO and connecting-line numbers, which are not recorded.

## Links

Dohrn's API page tells shippers to append the PRO to
`facts.dohrn.com/scripts/cgiip.exe/protraceext.htm?wpro=`, which opens one shipment, and
documents an XML trace that takes it as `pronum` on `protracexml.htm`. The search box on
`dohrn.com` sends any reference as `referencenumber` to `shipmenttrace.htm` on the same host.
The library reads the number from each form.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
