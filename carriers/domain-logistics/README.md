# Domain Logistics

Domain Logistics parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Domain Logistics is the Toronto logistics provider behind Domain Express, the direct-to-door
delivery of Ontario Cannabis Store orders. Archived lookups on its tracking page and its
tracking service carry twelve-digit numbers. The tracking form's example has nine letters and
digits, a layout no lookup shows, so its record stays in quarantine. Twelve digits are shared
with many other carriers, so no rule claims them.

## Links

The tracking page reads the number from its `tracking` parameter, on
`domainlogistics.ca/tracking/` and on the French page under `/tracking/fr/`, and loads the
status from Domain's tracking service. The library reads the number from either page.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
