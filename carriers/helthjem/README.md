# Helthjem

Helthjem parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Lookups archived from Helthjem's tracker show twenty-digit SSCCs starting `00` and the same
numbers without their `00`, under Norwegian and Swedish GS1 company prefixes. An SSCC names
whoever issued it rather than the carrier, so no rule claims either layout. Helthjem's search
form also takes a GS1 consignment number after `401` and a short code of one character, a dash
and five letters or digits; no lookup of either was archived.

## Links

Helthjem's search form opens the result at `helthjem.no/sporing/{number}`. Older links from its
own site carry the number in the `sporingsnummer` parameter of `/sporing`. The library reads
both.

## Testing

Provider live-test inputs and commands are in the [provider READMEs](../../providers/README.md).
