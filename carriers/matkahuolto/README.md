# Matkahuolto

Matkahuolto parcels use enabled universal providers. There is no dedicated adapter.

## Numbers

Lookups archived from Matkahuolto's tracker show its own numbers, `MH`, nine digits and `FI`
(sometimes typed in lower case), and `MA` followed by nineteen digits, as well as twenty-digit
SSCCs with or without their `00`. The `MH` numbers follow the UPU S10 layout with Finland's
code and a valid check digit, so they stay with the generic postal carrier. `matkahuolto-1`
claims the `MA` layout at low confidence, since Matkahuolto does not describe it. An SSCC names
whoever issued it rather than the carrier, so no rule claims those. The tracker also shows
partner posts' S10 numbers.

## Links

Matkahuolto's tracker at `matkahuolto.fi/seuranta` reads the number from its `parcelNumber`
parameter, as do its English `/tracking` and Swedish `/uppfoljning` pages; the tracker builds
such links itself for related shipments. The library reads all three.

## Testing

Provider live-test inputs and commands are in the [provider READMEs](../../providers/README.md).
