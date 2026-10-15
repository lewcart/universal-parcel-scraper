# Zheldorexpeditsia

Zheldorexpeditsia (JDE) parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

A consignment is tracked by the sixteen-digit number of its forwarding receipt (ЭР), which the
tracker's input mask writes in four groups of four. A low-confidence rule suggests the carrier
for that dashed layout as typed. Without the dashes it is sixteen digits, which several other
carriers share, so no rule claims it.

## Links

`i.jde.ru/track/?ttn={number}` opens the tracker for one consignment: its script reads the
number from the query and drops the dashes. The tracker asks for a captcha before it shows the
history, and an optional PIN code adds details.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
