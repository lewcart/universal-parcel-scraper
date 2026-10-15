# SAT

SAT parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

A consignment is tracked by its nine-digit waybill number, which the tracker page writes in
groups of three. Nine digits are shared by many carriers, so no rule claims them.

## Links

`www.sat.ua/tracking/?number={number}` opens one consignment: the home page's tracking form
sends the number there, and the tracker page looks it up on load and writes the number back in
groups of three.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
