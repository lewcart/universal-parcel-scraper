# Delovye Linii

Delovye Linii parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

A consignment's waybill is printed as a two-digit year, a hyphen and eleven digits. The tracker
takes it with or without the hyphen; without it, it is the thirteen-digit order number its
pages show. Thirteen digits are shared by many carriers and nothing in the number points to
Delovye Linii, so no rule claims it. Archived lookups also show shorter order numbers of seven
and eight digits, which are not kept.

## Links

`www.dellin.ru/tracker/orders/{number}/` opens one order, as archived lookups on Dellin's host
show; older lookups with the hyphenated waybill were redirected there. The search form posts
the number, and archived searches also pass it as `rwID` to `/tracker/`. The tracker shows the
route and status to anyone; parties and cargo details need a code sent to a phone on the
waybill.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
