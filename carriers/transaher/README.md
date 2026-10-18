# Transaher

Transaher parcels use enabled universal providers. There is no dedicated adapter.

Transaher is a Spanish transport and logistics group that delivers parcels across Spain and
Portugal, including home deliveries for online shops.

## Numbers

The tracking box on transaher.es accepts only numbers that start with `103`, and the site's
other tracking form requires exactly 27 digits. Archived lookups on Transaher's tracker carry
numbers of that layout. `transaher-1` claims 27 digits starting `103`, which no other carrier
rule matches.

## Links

The tracking box opens `clientes.transaher.es/webclient/htracking/-5,0,` followed by the
number; archived lookups also use the same address with `tracking` in place of `htracking`.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
