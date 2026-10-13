# Anjun Logistics

Anjun Logistics parcels use enabled universal providers. There is no dedicated adapter.

Anjun (安骏物流) is a Shenzhen cross-border logistics company with lines to Latin America,
Europe and North America. An archived lookup on its Portuguese tracker carries a Correios
number, the Brazilian carrier that delivers some of its parcels.

## Numbers

The only Anjun number seen is `AJ` and fifteen digits, a sample on an aggregator's page. One
sample does not settle the layout, so no rule claims it. Destination carriers' numbers stay
with their carrier.

## Links

The tracker on `anjuntrack.com` keeps the numbers it shows in `t` on `/trackQuery`,
separated by commas, so `anjuntrack.com/trackQuery?t={number}` opens one parcel. The
Portuguese site `pu.anjuntrack.com` uses the same address, and the home page's search form
sends `orderNum` to `/trajectory`.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
