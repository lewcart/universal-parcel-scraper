# Copa Airlines Courier

Copa Airlines Courier parcels use enabled universal providers. There is no dedicated adapter.

Copa Airlines Courier is the door-to-door courier service of Copa Airlines, based in Panama
with offices across Latin America, the Caribbean and the United States. In Cuba, Correos de
Cuba delivers its parcels under its own numbers.

## Numbers

Copa Courier tracks house air waybills (HAWB). Customers quote them as `H` followed by seven
digits, which `copa-courier-1` suggests with low confidence because GLS and Loggi rules for any
eight-character code also match that shape.

## Links

The tracking form posts the HAWB number, so no address opens one parcel.

## Testing

Provider live-test inputs and commands are in the
[provider READMEs](../../providers/README.md).
