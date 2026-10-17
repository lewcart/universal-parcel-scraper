# FleetOptics

FleetOptics parcels use enabled universal providers. There is no dedicated adapter.

FleetOptics is a final-mile parcel carrier for online retailers in Ontario, Quebec, Alberta and
British Columbia.

## Numbers

FleetOptics labels carry `F`, a code for the shipper and a run of digits, sometimes with
letters: archived lookups on the tracker show seven shipper codes with fixed lengths, which
`fleetoptics-1` claims. Other shippers' codes and lengths are not known, so the rule covers
only these. The tracker also answers for retailers' own package IDs, such as `SON` or `IND`
followed by digits, which name the shipper rather than the carrier and stay unclaimed.

## Links

The tracking form on `track.fleetopticsinc.com` sends the number as `tracking_number`, so
`track.fleetopticsinc.com/?tracking_number={number}` opens one parcel; its French page is
under `/fr/`. The older `delivery.fleetopticsinc.com/tracking/` and `fleetopticsinc.ca`
portal addresses carry the same parameter; the library reads the number from all of them.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
