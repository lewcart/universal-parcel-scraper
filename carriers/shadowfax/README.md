# Shadowfax

Shadowfax parcels use enabled universal providers. There is no dedicated adapter.

Shadowfax is an Indian last-mile and e-commerce courier that delivers and picks up returns for
marketplaces and online shops.

## Numbers

The tracker asks for an AWB number. Customers quote `SF`, nine to twelve digits and a
three-letter merchant code, which `shadowfax-1` claims, and for return pickups `R`, ten digits
and the merchant code, which `shadowfax-2` suggests with low confidence because only one report
shows it.

## Links

The search page sends the number to Shadowfax's tracker, which opens one parcel at
`tracker.shadowfax.in/#/awb/{number}`. The tracker turns the AWB into an internal code and
redirects to `#/track/{code}/{type}`; that code is not the AWB, so only the `awb` route is
read.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
