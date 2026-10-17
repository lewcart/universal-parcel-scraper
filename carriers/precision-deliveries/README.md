# Precision Deliveries

Precision Deliveries parcels use enabled universal providers. There is no dedicated adapter.

Precision Parcel and Package Deliveries is the Fastfrate Group's final-mile network in Canada.
It was the final-mile division of ASL Distribution and delivers parcels for Amazon and for
shipping platforms such as Stallion Express. ASL Distribution's tracking page sends final-mile
parcels to Precision's tracker.

## Numbers

Archived replies of its tracking API show two layouts: ASL and ten digits, and PRE, six digits
and five letters or digits. The ASL rule is high because the prefix is the network's former
name and no other carrier uses the layout. The PRE layout has a single sample, so no rule
claims it. A shipping platform's own reference on the same parcel belongs to that platform,
such as stallion-express.

## Links

`track.precisiondeliveries.com/` followed by the number opens one parcel. Archived lookups
sometimes repeat the number in a `tracking` query parameter.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
